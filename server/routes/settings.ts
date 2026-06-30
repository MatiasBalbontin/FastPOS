import express from 'express';
import { db } from '../db/index';

const router = express.Router();

// Get settings
router.get('/', (req, res, next) => {
  try {
    const settings = db.prepare("SELECT * FROM company_settings").all() as { key: string, value: string }[];
    const config: Record<string, string> = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });
    res.json(config);
  } catch (error: any) {
    next(error);
  }
});

// Update settings
router.post('/', (req, res, next) => {
  const settings = req.body;
  try {
    const transaction = db.transaction(() => {
      const insertSetting = db.prepare("INSERT INTO company_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      for (const [key, value] of Object.entries(settings)) {
        insertSetting.run(key, String(value));
      }
    });
    transaction();
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
