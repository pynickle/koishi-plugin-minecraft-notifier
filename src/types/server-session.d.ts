import type * as OneBot from '@koishijs/plugin-server/index';

declare module 'koishi' {
  interface Context {
    [Context.Server]: Context.Server<this>;
    server: Server & this[typeof Context.Server];
  }
}
