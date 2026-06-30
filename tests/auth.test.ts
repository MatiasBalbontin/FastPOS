import { describe, it, expect } from 'vitest';
import { hashPassword } from '../server/middleware/auth';
import { z } from 'zod';

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50).toLowerCase().trim(),
  password: z.string().min(4),
  permissions: z.array(z.string())
});

const UpdateUserSchema = z.object({
  permissions: z.array(z.string()).optional(),
  password: z.string().min(4).optional(),
  active: z.number().int().min(0).max(1).optional()
});

describe('User Authentication & Security Helpers', () => {
  it('should correctly hash passwords using SHA-256', () => {
    const raw = 'admin';
    const hashed = hashPassword(raw);
    
    // SHA-256 hash of 'admin'
    const expected = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    
    expect(hashed).toBe(expected);
    expect(hashed.length).toBe(64);
  });

  it('should accept valid user payload', () => {
    const valid = {
      username: 'cajero1',
      password: 'supersecretpassword',
      permissions: ['sales', 'inventory']
    };
    
    const res = CreateUserSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('should reject short username in CreateUserSchema', () => {
    const invalid = {
      username: 'ca', // too short
      password: 'password123',
      permissions: ['sales']
    };
    
    const res = CreateUserSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('should validate update schemas', () => {
    const validUpdate = {
      active: 0,
      permissions: ['sales', 'quotes']
    };
    
    const res = UpdateUserSchema.safeParse(validUpdate);
    expect(res.success).toBe(true);
  });
});
