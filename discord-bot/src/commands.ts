import * as ping from "./commands/ping";
import * as checkserver from "./commands/check-server";
import * as checkready from "./commands/check-ready";
import * as createserver from "./commands/create-server";
import * as startserver from "./commands/start-server";
import * as listserver from "./commands/list-server";

export const commands = {
  ping,
  checkserver,
  checkready,
  createserver,
  startserver,
  listserver,
};
