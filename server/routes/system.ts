import express from 'express';
import { exec, execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { requirePermission } from '../middleware/auth';

const router = express.Router();
router.use(requirePermission('configuration'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');

// Only alphanumeric, dots, hyphens, slashes — rejects shell metacharacters
const SAFE_BRANCH_RE = /^[a-zA-Z0-9._\-\/]+$/;

type CmdResult = { code: number; stdout: string; stderr: string };

// Shell commands for npm (no user-controlled input interpolated)
function runCmd(cmd: string, cwd: string): Promise<CmdResult> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error ? ((error as any).code || 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

// Git commands via execFile — no shell, branch name is a separate argument (safe)
function runGit(args: string[], cwd: string): Promise<CmdResult> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error ? ((error as any).code || 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

// Get system update status
router.get('/status', async (req, res, next) => {
  try {
    const gitCheck = await runGit(['--version'], projectRoot);
    if (gitCheck.code !== 0) {
      return res.json({
        gitInstalled: false,
        branch: 'Desconocida',
        localChanges: false,
        commitsBehind: 0,
        error: 'Git no está instalado o no se encuentra en el PATH del servidor.'
      });
    }

    const branchCheck = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot);
    const branch = branchCheck.code === 0 ? branchCheck.stdout : 'oficialoffline';

    const statusCheck = await runGit(['status', '--porcelain'], projectRoot);
    const localChanges = statusCheck.stdout.length > 0;

    const fetchCheck = await runGit(['fetch', 'origin'], projectRoot);
    let commitsBehind = 0;
    let fetchError = '';

    if (fetchCheck.code === 0) {
      const behindCheck = await runGit(['rev-list', '--count', `HEAD..origin/${branch}`], projectRoot);
      if (behindCheck.code === 0) {
        commitsBehind = parseInt(behindCheck.stdout, 10) || 0;
      }
    } else {
      fetchError = 'No se pudo conectar con el servidor de actualizaciones (GitHub). Verifique la conexión a internet.';
    }

    res.json({
      gitInstalled: true,
      branch,
      localChanges,
      commitsBehind,
      fetchError: fetchError || null
    });
  } catch (error: any) {
    next(error);
  }
});

// Run system update
router.post('/update', async (req, res, next) => {
  const { force } = req.body;
  const logs: string[] = [];

  try {
    const branchCheck = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot);
    const branch = branchCheck.code === 0 ? branchCheck.stdout : 'oficialoffline';

    if (!SAFE_BRANCH_RE.test(branch)) {
      return res.status(400).json({ success: false, logs, error: `Nombre de rama inválido: "${branch}". Abortando por seguridad.` });
    }

    const logAndRun = async (label: string, runner: () => Promise<CmdResult>): Promise<boolean> => {
      logs.push(`> ${label}`);
      const result = await runner();
      if (result.stdout) logs.push(result.stdout);
      if (result.stderr) logs.push(result.stderr);
      if (result.code !== 0) {
        logs.push(`Error: El comando falló con código de salida ${result.code}`);
        return false;
      }
      return true;
    };

    if (!await logAndRun('git fetch origin', () => runGit(['fetch', 'origin'], projectRoot))) {
      return res.status(500).json({ success: false, logs, error: 'Error al consultar actualizaciones desde GitHub.' });
    }

    if (force) {
      if (!await logAndRun(`git reset --hard origin/${branch}`, () => runGit(['reset', '--hard', `origin/${branch}`], projectRoot))) {
        return res.status(500).json({ success: false, logs, error: 'Error al forzar la alineación del código con GitHub.' });
      }
    } else {
      const statusCheck = await runGit(['status', '--porcelain'], projectRoot);
      const hasLocalChanges = statusCheck.stdout.length > 0;

      if (hasLocalChanges) {
        if (!await logAndRun('git stash', () => runGit(['stash'], projectRoot))) {
          return res.status(500).json({ success: false, logs, error: 'Error al resguardar cambios locales (git stash).' });
        }
      }

      if (!await logAndRun(`git pull origin ${branch}`, () => runGit(['pull', 'origin', branch], projectRoot))) {
        if (hasLocalChanges) {
          await runGit(['stash', 'pop'], projectRoot);
        }
        return res.status(500).json({ success: false, logs, error: 'Error al descargar el código nuevo (git pull).' });
      }

      if (hasLocalChanges) {
        const popSuccess = await logAndRun('git stash pop', () => runGit(['stash', 'pop'], projectRoot));
        if (!popSuccess) {
          logs.push('ADVERTENCIA: Hubo conflictos al restaurar cambios locales. Resuelva los conflictos manualmente antes de continuar.');
          return res.status(500).json({
            success: false,
            logs,
            error: 'Conflicto en git stash pop. El código fue descargado pero sus cambios locales no pudieron re-aplicarse automáticamente.'
          });
        }
      }
    }

    // Install dependencies — fatal if it fails
    if (!await logAndRun('npm install --no-fund', () => runCmd('npm install --no-fund', projectRoot))) {
      return res.status(500).json({ success: false, logs, error: 'Error al instalar dependencias (npm install). Las dependencias pueden estar desactualizadas.' });
    }

    // Build frontend production files
    if (!await logAndRun('npm run build', () => runCmd('npm run build', projectRoot))) {
      return res.status(500).json({ success: false, logs, error: 'Error al compilar los archivos de producción (npm run build).' });
    }

    logs.push('► Actualización completada. El servidor se reiniciará en 2 segundos...');
    res.json({ success: true, logs });

    // Restart the server process so new server-side code takes effect.
    // IniciarFastPOS.bat has a restart loop that brings the process back up automatically.
    setTimeout(() => process.exit(0), 2000);

  } catch (error: any) {
    next(error);
  }
});

export default router;
