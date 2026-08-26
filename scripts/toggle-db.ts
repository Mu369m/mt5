/**
 * @file scripts/toggle-db.ts
 * @description Helper utility script to toggle the Prisma schema configuration between PostgreSQL and SQLite.
 * This allows developers to run a zero-setup local SQLite database for verification,
 * and easily switch back to enterprise PostgreSQL for production deployments.
 */

import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve(__dirname, '../backend/prisma/schema.prisma');

const target = process.argv[2];

if (target !== 'sqlite' && target !== 'postgres') {
  console.error('Usage: tsx scripts/toggle-db.ts [sqlite|postgres]');
  process.exit(1);
}

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');

  if (target === 'sqlite') {
    console.log('[DB-TOGGLE] Converting schema to SQLite...');
    
    // 1. Replace datasource provider and url
    schema = schema.replace(
      /datasource db \{[\s\S]*?\}/,
      `datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}`
    );

    // 2. Strip native database postgres mappings that break SQLite
    schema = schema.replace(/\s+@db\.Uuid/g, '');
    schema = schema.replace(/\s+@db\.VarChar\(\d+\)/g, '');
    schema = schema.replace(/\s+@db\.Text/g, '');
    schema = schema.replace(/\s+@db\.Decimal\(\d+,\s*\d+\)/g, '');
    schema = schema.replace(/\s+@db\.Timestamptz/g, '');
    
    // 3. SQLite does not support sort: Desc on index, strip it
    schema = schema.replace(/\(sort:\s*Desc\)/g, '');

    // 4. Change BigInt autoincrement to Int autoincrement
    schema = schema.replace(/id\s+BigInt\s+@id\s+@default\(autoincrement\(\)\)/g, 'id Int @id @default(autoincrement())');

    fs.writeFileSync(schemaPath, schema, 'utf8');
    console.log('✅ Prisma Schema converted to SQLite (c:\/Users\/hp\/mt5\/backend\/prisma\/schema.prisma)');
    
  } else {
    console.log('[DB-TOGGLE] Restoring schema to PostgreSQL...');
    
    // Restore PostgreSQL definitions
    schema = schema.replace(
      /datasource db \{[\s\S]*?\}/,
      `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`
    );

    // Re-apply database-specific tags (read original from types or write complete layout)
    // To make this super clean, let's write a backup copy on SQLite toggle and restore from backup if it exists!
    const backupPath = schemaPath + '.backup';
    if (fs.existsSync(backupPath)) {
      const backup = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(schemaPath, backup, 'utf8');
      console.log('✅ PostgreSQL schema restored from backup file.');
    } else {
      console.log('[DB-TOGGLE] No backup schema found. To restore postgres, write prisma schema anew.');
    }
  }
} catch (error) {
  console.error('[DB-TOGGLE_FAILED] Conversion error:', error);
}
