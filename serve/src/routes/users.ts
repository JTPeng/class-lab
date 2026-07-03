import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { login, InvalidCredentialsError } from '../db/users.js';
import { getModuleData, putModuleData } from '../db/moduleData.js';

export interface UserRoutesDeps {
  db: Database.Database;
}

const LoginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(100),
});
const PutDataSchema = z.object({ data: z.unknown() });

// 允许的模块名，防止任意写入。三个菜单模块。
const MODULES = ['games', 'lessons', 'picture-book'] as const;
const ModuleSchema = z.enum(MODULES);

export async function registerUserRoutes(app: FastifyInstance, deps: UserRoutesDeps) {
  const { db } = deps;

  // 账号+密码登录：没有该用户名则自动注册；老账号无密码时补种本次密码；否则校验密码。
  app.post('/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: '用户名或密码不能为空', issues: parsed.error.issues });
    }
    try {
      const { password: _password, ...safeUser } = login(db, parsed.data.username, parsed.data.password);
      return reply.status(200).send(safeUser);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: err.message });
      }
      throw err;
    }
  });

  // 取某用户在某模块某 key 的数据（如游戏分数）。无数据返回 { data: null }。
  app.get<{ Params: { userId: string; module: string; key: string } }>(
    '/users/:userId/modules/:module/:key',
    async (request, reply) => {
      const module = ModuleSchema.safeParse(request.params.module);
      if (!module.success) return reply.status(400).send({ error: '未知模块' });
      const data = getModuleData(db, request.params.userId, module.data, request.params.key);
      return reply.status(200).send({ data });
    },
  );

  // upsert 某用户在某模块某 key 的数据。
  app.put<{ Params: { userId: string; module: string; key: string } }>(
    '/users/:userId/modules/:module/:key',
    async (request, reply) => {
      const module = ModuleSchema.safeParse(request.params.module);
      if (!module.success) return reply.status(400).send({ error: '未知模块' });
      const parsed = PutDataSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: '缺少 data' });
      putModuleData(db, request.params.userId, module.data, request.params.key, parsed.data.data);
      return reply.status(200).send({ ok: true });
    },
  );
}
