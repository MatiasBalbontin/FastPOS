import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { requirePermission } from '../middleware/auth';

const router = express.Router();
router.use(requirePermission('configuration'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');

function runCmd(cmd: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error ? (error.code || 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

// Get system update status
router.get('/status', async (req, res, next) => {
  try {
    // 1. Check if git is installed
    const gitCheck = await runCmd('git --version', projectRoot);
    if (gitCheck.code !== 0) {
      return res.json({
        gitInstalled: false,
        branch: 'Desconocida',
        localChanges: false,
        commitsBehind: 0,
        error: 'Git no está instalado o no se encuentra en el PATH del servidor.'
      });
    }

    // 2. Get current branch name
    const branchCheck = await runCmd('git rev-parse --abbrev-ref HEAD', projectRoot);
    const branch = branchCheck.code === 0 ? branchCheck.stdout : 'oficialoffline';

    // 3. Get local changes status
    const statusCheck = await runCmd('git status --porcelain', projectRoot);
    const localChanges = statusCheck.stdout.length > 0;

    // 4. Fetch from origin to get remote updates information
    const fetchCheck = await runCmd('git fetch origin', projectRoot);
    let commitsBehind = 0;
    let fetchError = '';

    if (fetchCheck.code === 0) {
      const behindCheck = await runCmd(`git rev-list --count HEAD..origin/${branch}`, projectRoot);
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
    // 1. Get branch
    const branchCheck = await runCmd('git rev-parse --abbrev-ref HEAD', projectRoot);
    const branch = branchCheck.code === 0 ? branchCheck.stdout : 'oficialoffline';

    // Helper to log and run command
    const executeAndLog = async (cmd: string): Promise<boolean> => {
      logs.push(`> ${cmd}`);
      const result = await runCmd(cmd, projectRoot);
      if (result.stdout) logs.push(result.stdout);
      if (result.stderr) logs.push(result.stderr);
      if (result.code !== 0) {
        logs.push(`Error: El comando falló con código de salida ${result.code}`);
        return false;
      }
      return true;
    };

    // 2. Fetch remote changes
    if (!await executeAndLog('git fetch origin')) {
      return res.status(500).json({ success: false, logs, error: 'Error al consultar actualizaciones desde GitHub.' });
    }

    if (force) {
      // Hard reset
      if (!await executeAndLog(`git reset --hard origin/${branch}`)) {
        return res.status(500).json({ success: false, logs, error: 'Error al forzar la alineación del código con GitHub.' });
      }
    } else {
      // Safe update
      const statusCheck = await runCmd('git status --porcelain', projectRoot);
      const hasLocalChanges = statusCheck.stdout.length > 0;

      if (hasLocalChanges) {
        if (!await executeAndLog('git stash')) {
          return res.status(500).json({ success: false, logs, error: 'Error al resguardar cambios locales (git stash).' });
        }
      }

      if (!await executeAndLog(`git pull origin ${branch}`)) {
        if (hasLocalChanges) {
          await runCmd('git stash pop', projectRoot);
        }
        return res.status(500).json({ success: false, logs, error: 'Error al descargar el código nuevo (git pull).' });
      }

      if (hasLocalChanges) {
        const popSuccess = await executeAndLog('git stash pop');
        if (!popSuccess) {
          logs.push('ADVERTENCIA: Hubo conflictos al volver a aplicar tus cambios locales. Por favor resuélvalos manualmente.');
        }
      }
    }

    // 3. Install dependencies
    logs.push('> npm install --no-fund');
    const npmCheck = await runCmd('npm install --no-fund', projectRoot);
    if (npmCheck.stdout) logs.push(npmCheck.stdout);
    if (npmCheck.stderr) logs.push(npmCheck.stderr);
    if (npmCheck.code !== 0) {
      logs.push(`Advertencia: npm install finalizó con código ${npmCheck.code}. Las dependencias podrían no estar al día.`);
    }

    res.json({
      success: true,
      logs
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
