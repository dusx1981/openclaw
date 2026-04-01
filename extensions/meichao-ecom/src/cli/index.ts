import type { Command } from "commander";

export function registerMeichaoCli(program: Command): void {
  const meichao = program
    .command("meichao")
    .description("美潮龙虾跨境电商数据采集工具")
    .action(() => {
      meichao.outputHelp();
    });

  meichao
    .command("fetch <platform> <productId>")
    .description("从指定平台获取商品数据")
    .option("--json", "输出 JSON 格式", false)
    .action(async (platform: string, productId: string, opts: { json?: boolean }) => {
      const { fetchCommand } = await import("./fetch-command.js");
      await fetchCommand(platform, productId, opts);
    });

  meichao
    .command("search <platform> <keyword>")
    .description("在指定平台搜索商品")
    .option("-l, --limit <number>", "限制结果数量", "50")
    .option("--json", "输出 JSON 格式", false)
    .action(async (platform: string, keyword: string, opts: { limit?: string; json?: boolean }) => {
      const { searchCommand } = await import("./search-command.js");
      const limit = opts.limit ? parseInt(opts.limit, 10) : 50;
      await searchCommand(platform, keyword, { ...opts, limit });
    });

  meichao
    .command("validate [platform]")
    .description("验证平台数据采集功能")
    .option("-c, --count <number>", "验证请求数量", "10")
    .option("--all", "验证所有平台", false)
    .option("--json", "输出 JSON 格式", false)
    .action(
      async (
        platform: string | undefined,
        opts: { count?: string; all?: boolean; json?: boolean },
      ) => {
        const { validateCommand } = await import("./validate-command.js");
        const count = opts.count ? parseInt(opts.count, 10) : 10;
        await validateCommand(platform, { ...opts, count });
      },
    );

  meichao
    .command("platforms")
    .description("列出所有支持的平台")
    .action(async () => {
      const { platformsCommand } = await import("./platforms-command.js");
      await platformsCommand();
    });
}
