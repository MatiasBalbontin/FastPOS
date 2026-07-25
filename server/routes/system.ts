import express from 'express';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { requirePermission } from '../middleware/auth';
import { db } from '../db/index';

const router = express.Router();
router.use(requirePermission('configuration'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');

function run(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, shell: false, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        code: error ? ((error as any).code ?? 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

const git = (args: string[], cwd: string) => run('git', args, cwd);
const npm = (args: string[], cwd: string) => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd);

// Git branch names are effectively trusted (set up by whoever configured the
// repo, never remote/user input), but we still whitelist the charset before
// it's ever used as a git ref argument.
const isSafeBranchName = (branch: string) => /^[\w.\-\/]+$/.test(branch);

async function getBranch(cwd: string): Promise<string | null> {
  const result = await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (result.code !== 0 || !result.stdout || !isSafeBranchName(result.stdout)) return null;
  return result.stdout;
}

// Restarting the node process itself (instead of relying on tsx watch's
// implicit file-change reload) avoids leaving the app half-updated when
// node_modules was just replaced by npm install. IniciarFastPOS.bat runs
// "npm run dev" inside a supervisor loop that relaunches it automatically
// whenever the process exits, so this comes back up on its own.
function scheduleRestart() {
  setTimeout(() => process.exit(0), 800);
}

// GET /api/system/status
router.get('/status', async (req, res, next) => {
  try {
    const gitCheck = await git(['--version'], projectRoot);
    if (gitCheck.code !== 0) {
      return res.json({
        gitInstalled: false,
        branch: null,
        localChanges: false,
        commitsBehind: 0,
        error: 'Git no está instalado o no se encuentra en el PATH del servidor.'
      });
    }

    const branch = await getBranch(projectRoot);
    if (!branch) {
      return res.json({
        gitInstalled: true,
        branch: null,
        localChanges: false,
        commitsBehind: 0,
        error: 'No se pudo determinar la rama activa del repositorio.'
      });
    }

    const statusCheck = await git(['status', '--porcelain'], projectRoot);
    const localChanges = statusCheck.stdout.length > 0;

    const fetchCheck = await git(['fetch', 'origin', branch], projectRoot);
    let commitsBehind = 0;
    let fetchError: string | null = null;

    if (fetchCheck.code === 0) {
      const behindCheck = await git(['rev-list', '--count', `HEAD..origin/${branch}`], projectRoot);
      if (behindCheck.code === 0) {
        commitsBehind = parseInt(behindCheck.stdout, 10) || 0;
      }
    } else {
      fetchError = 'No se pudo conectar con el servidor de actualizaciones (GitHub). Verifique la conexión a internet.';
    }

    res.json({ gitInstalled: true, branch, localChanges, commitsBehind, fetchError });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/system/update
router.post('/update', async (req, res, next) => {
  const force = req.body?.force === true;
  const logs: string[] = [];

  const logCmd = (label: string, result: { stdout: string; stderr: string }) => {
    logs.push(`> ${label}`);
    if (result.stdout) logs.push(result.stdout);
    if (result.stderr) logs.push(result.stderr);
  };

  try {
    const branch = await getBranch(projectRoot);
    if (!branch) {
      return res.status(500).json({ success: false, logs, error: 'No se pudo determinar la rama activa del repositorio.' });
    }

    const beforeHead = (await git(['rev-parse', 'HEAD'], projectRoot)).stdout;

    const fetchResult = await git(['fetch', 'origin', branch], projectRoot);
    logCmd('git fetch origin ' + branch, fetchResult);
    if (fetchResult.code !== 0) {
      return res.status(500).json({ success: false, logs, error: 'Error al consultar actualizaciones desde GitHub.' });
    }

    if (force) {
      const resetResult = await git(['reset', '--hard', `origin/${branch}`], projectRoot);
      logCmd(`git reset --hard origin/${branch}`, resetResult);
      if (resetResult.code !== 0) {
        return res.status(500).json({ success: false, logs, error: 'Error al forzar la alineación del código con GitHub.' });
      }
    } else {
      const statusCheck = await git(['status', '--porcelain'], projectRoot);
      const hasLocalChanges = statusCheck.stdout.length > 0;

      if (hasLocalChanges) {
        const stashResult = await git(['stash'], projectRoot);
        logCmd('git stash', stashResult);
        if (stashResult.code !== 0) {
          return res.status(500).json({ success: false, logs, error: 'Error al resguardar cambios locales (git stash).' });
        }
      }

      const pullResult = await git(['pull', '--ff-only', 'origin', branch], projectRoot);
      logCmd(`git pull --ff-only origin ${branch}`, pullResult);
      if (pullResult.code !== 0) {
        if (hasLocalChanges) await git(['stash', 'pop'], projectRoot);
        return res.status(500).json({
          success: false,
          logs,
          error: 'Error al descargar el código nuevo (git pull). Si tiene cambios locales que generan conflicto, use la Actualización Limpia.'
        });
      }

      if (hasLocalChanges) {
        const popResult = await git(['stash', 'pop'], projectRoot);
        logCmd('git stash pop', popResult);
        if (popResult.code !== 0) {
          logs.push('ADVERTENCIA: Hubo conflictos al volver a aplicar tus cambios locales. Por favor resuélvalos manualmente.');
        }
      }
    }

    const afterHead = (await git(['rev-parse', 'HEAD'], projectRoot)).stdout;

    // Only reinstall dependencies when the pulled changes actually touched
    // package.json / package-lock.json — this is both faster and safer, since
    // npm install while the running process still has node_modules loaded
    // is the riskiest part of an in-place update on Windows.
    let depsChanged = true;
    if (beforeHead && afterHead && beforeHead !== afterHead) {
      const changedFiles = await git(['diff', '--name-only', beforeHead, afterHead], projectRoot);
      depsChanged = /(^|\n)package(-lock)?\.json$/m.test(changedFiles.stdout);
    } else if (beforeHead === afterHead) {
      depsChanged = false;
    }

    if (depsChanged) {
      const npmResult = await npm(['install', '--no-fund'], projectRoot);
      logCmd('npm install --no-fund', npmResult);
      if (npmResult.code !== 0) {
        logs.push(`Advertencia: npm install finalizó con código ${npmResult.code}. Las dependencias podrían no estar al día.`);
      }
    } else {
      logs.push('Sin cambios en las dependencias, se omite npm install.');
    }

    logs.push('Reiniciando el servidor para aplicar la actualización...');
    res.json({ success: true, logs, restarting: true });
    scheduleRestart();
  } catch (error: any) {
    next(error);
  }
});

// GET /api/system/audit-logs
router.get('/audit-logs', (req, res, next) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 500
    `).all() as any[];

    const formatted = logs.map(l => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null
    }));

    res.json(formatted);
  } catch (error: any) {
    next(error);
  }
});

export default router;
