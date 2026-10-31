// One-shot user administration for the LibreChat add-on.
//
// Triggered by the librechat s6 service before the app starts: if
// /config/useradm.json exists, it is processed and renamed to
// useradm.done.json (with a result summary appended), so a single file
// performs exactly one action set. The add-on has no shell access on
// Home Assistant OS, and LibreChat 0.8.8 exposes no admin API to
// create/ban/delete accounts - this file hook is the supported way to
// manage accounts from outside the container.
//
// Commands (combine as needed):
//   { "list": true }                                  - list all users
//   { "ban": ["name-or-email", ...] }                 - block login (reversible)
//   { "unban": ["name-or-email", ...] }               - allow login again
//   { "delete": ["name-or-email", ...], "confirm": true }
//                                                     - delete accounts incl. their
//                                                       data; without "confirm": true
//                                                       only shows what would be removed
//
// Safety rails: users with the ADMIN role are never modified or deleted,
// and identifiers must match exactly (username or email or _id).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/app/package.json');
const { MongoClient, ObjectId } = require('mongodb');

const CMD_FILE = '/config/useradm.json';
const DONE_FILE = '/config/useradm.done.json';

// Collections that may hold per-user documents, with the field carrying
// the user reference. Field values are matched as ObjectId AND string -
// LibreChat schemas use both forms. Collections that do not exist in this
// database are skipped silently.
//
// Verified against the Mongoose models and schemas of LibreChat v0.8.8
// (packages/data-schemas): collection names follow the model names
// (AgentApiKey -> agentapikeys, PluginAuth -> pluginauths, SharedLink ->
// sharedlinks, ...), the reference field differs per model (user, userId,
// author, createdBy). The set covers the per-user collections of that
// release; shared resources owned only through ACLs are not resolved, so
// the residual scan below reports anything that still references the
// deleted account.
const USER_REFS = [
  ['conversations', 'user'],
  ['messages', 'user'],
  ['sessions', 'user'],
  ['presets', 'user'],
  ['promptgroups', 'author'],
  ['prompts', 'author'],
  ['files', 'user'],
  ['keys', 'userId'],
  ['transactions', 'user'],
  ['balances', 'user'],
  ['sharedlinks', 'user'],
  ['toolcalls', 'user'],
  ['agents', 'author'],
  ['agentapikeys', 'userId'],
  ['assistants', 'user'],
  ['conversationtags', 'user'],
  ['memories', 'userId'],
  ['skills', 'author'],
  ['mcpservers', 'author'],
  ['actions', 'user'],
  ['tokens', 'userId'],
  ['aclentries', 'principalId'],
  ['schedules', 'user'],
  ['codeenvironments', 'createdBy'],
  ['pluginauths', 'userId'],
  ['toolfavorites', 'user'],
  ['chatprojects', 'user'],
  ['agentqueuedturns', 'user'],
  ['agentqueuedturnsequences', 'user'],
  ['skillfiles', 'author'],
  ['skillsynccredentials', 'createdBy'],
  ['skillsyncstatuses', 'owner'],
  ['refreshtokenbridges', 'userId'],
  ['agenttriggerdeliveries', 'user'],
  ['agenttriggerlanesequences', 'user'],
  ['systemgrants', 'principalId'],
];

// Fields that can reference a user, used by the residual diagnostic after
// a deletion. Keep in sync with the models above.
const REF_FIELDS = ['user', 'userId', 'author', 'createdBy', 'owner', 'principalId', 'memberIds'];

const log = (...args) => console.log('[useradm]', ...args);

function readMongoUri() {
  try {
    const env = fs.readFileSync('/config/.env', 'utf8');
    const match = env.match(/^MONGO_URI=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* fall through to default */
  }
  return 'mongodb://127.0.0.1:27017/LibreChat';
}

async function resolveUsers(collection, identifiers) {
  const or = identifiers.flatMap((id) => {
    const cond = [{ username: id }, { email: id }];
    if (/^[0-9a-f]{24}$/i.test(id)) cond.push({ _id: new ObjectId(id) });
    return cond;
  });
  return collection.find({ $or: or }).toArray();
}

async function main() {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(CMD_FILE, 'utf8'));
  } catch (error) {
    log(`ERROR: ${CMD_FILE} is not valid JSON (${error.message}); ignoring it`);
    fs.writeFileSync(DONE_FILE, `invalid command file: ${error.message}\n`);
    fs.unlinkSync(CMD_FILE);
    return;
  }

  const uri = readMongoUri();
  const dbName = new URL(uri.replace('mongodb://', 'http://')).pathname.replace(/^\//, '') || 'LibreChat';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const results = { ranAt: new Date().toISOString(), actions: [] };
  const deletedUsers = [];

  if (spec.list) {
    log(`Users in database "${dbName}":`);
    for (const user of await users.find({}).sort({ createdAt: 1 }).toArray()) {
      log(
        `  ${user.username ?? '?'} | ${user.email ?? '?'} | role=${user.role}` +
          ` | banned=${String(Boolean(user.banned))} | created=${user.createdAt?.toISOString?.() ?? '?'} | id=${user._id}`,
      );
    }
    results.actions.push('list');
  }

  for (const op of ['ban', 'unban']) {
    const targets = spec[op];
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const found = await resolveUsers(users, targets);
    const skipped = found.filter((u) => u.role === 'ADMIN');
    const apply = found.filter((u) => u.role !== 'ADMIN');
    for (const user of skipped) log(`REFUSED to ${op} ADMIN account ${user.username}`);
    if (apply.length > 0) {
      await users.updateMany(
        { _id: { $in: apply.map((u) => u._id) } },
        { $set: { banned: op === 'ban' } },
      );
      for (const user of apply) log(`${op === 'ban' ? 'BANNED' : 'UNBANNED'} ${user.username} (${user.email})`);
    }
    for (const id of targets) {
      if (!found.some((u) => u.username === id || u.email === id || u._id.toString() === id))
        log(`WARNING: no user matches "${id}"`);
    }
    results.actions.push(`${op}: ${apply.map((u) => u.username).join(', ') || 'none'}`);
  }

  if (Array.isArray(spec.delete) && spec.delete.length > 0) {
    const dry = spec.confirm !== true;
    const found = await resolveUsers(users, spec.delete);
    const skipped = found.filter((u) => u.role === 'ADMIN');
    const victims = found.filter((u) => u.role !== 'ADMIN');
    for (const user of skipped) log(`REFUSED to delete ADMIN account ${user.username}`);
    for (const id of spec.delete) {
      if (!found.some((u) => u.username === id || u.email === id || u._id.toString() === id))
        log(`WARNING: no user matches "${id}"`);
    }
    if (dry) {
      log('DRY RUN - nothing deleted. Delete exactly these accounts by adding "confirm": true:');
    }
    for (const user of victims) {
      log(`${dry ? 'WOULD DELETE' : 'DELETING'} ${user.username} (${user.email}, id=${user._id})`);
      if (dry) continue;
      const ids = [user._id, user._id.toString()];
      let removed = 0;
      for (const [name, field] of USER_REFS) {
        if (!existing.has(name)) continue;
        const res = await db.collection(name).deleteMany({ [field]: { $in: ids } });
        removed += res.deletedCount;
      }
      // Group membership is a string array (`memberIds`) on the group
      // document; roles have no member list (a user's role lives in
      // users.role), so there is nothing to pull from roles.
      if (existing.has('groups')) {
        await db.collection('groups').updateMany(
          {},
          { $pull: { memberIds: { $in: [user._id.toString(), user._id] } } },
        );
      }
      const res = await users.deleteOne({ _id: user._id });
      removed += res.deletedCount;
      log(`  removed ${removed} documents for ${user.username}`);
      results.actions.push(`deleted: ${user.username} (${removed} docs)`);
      deletedUsers.push({ id: user._id, label: user.username ?? user.email ?? String(user._id) });
    }
    if (dry && victims.length > 0) results.actions.push('dry-run delete (re-run with confirm)');
  }

  // Diagnostic safety net: collection/reference drift upstream would
  // otherwise leave user data behind silently. Report anything that still
  // points at a deleted account (no further deletion - review manually).
  if (deletedUsers.length > 0) {
    const residual = [];
    for (const { id, label } of deletedUsers) {
      const ids = [id, id.toString()];
      for (const name of existing) {
        if (name === 'users') continue;
        const query = { $or: REF_FIELDS.map((field) => ({ [field]: { $in: ids } })) };
        let count = 0;
        try {
          count = await db.collection(name).countDocuments(query);
        } catch {
          continue; // unreadable/unsupported collection - skip
        }
        if (count > 0) {
          residual.push(`${name}: ${count} (${label})`);
          log(`WARNING: ${count} document(s) in "${name}" still reference ${label}`);
        }
      }
    }
    if (residual.length > 0) {
      log('Residual references remain; review the collections above.');
      results.residual = residual;
    } else {
      log('Residual check: no documents reference the deleted account(s).');
    }
  }

  await client.close();
  fs.writeFileSync(DONE_FILE, JSON.stringify(results, null, 2) + '\n');
  fs.unlinkSync(CMD_FILE);
  log(`Done. Result summary written to ${DONE_FILE}`);
}

main()
  .catch((error) => {
    log(`ERROR: ${error.message}`);
    log('The command file was kept; fix it and restart the add-on to retry.');
    process.exitCode = 0; // never block the chat from starting
  })
  .finally(() => {
    /* client closed in main() */
  });
