{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  languages.typescript.enable = true;

  packages = [
    pkgs.playwright-driver.browsers
    pkgs.playwright
    pkgs.playwright-test
  ];

  env.PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
  env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

  process.managers.process-compose.package = pkgs.process-compose;
  process.manager.implementation = "process-compose";

  scripts = {
    deploy.exec = ''
      pnpm build && npx wrangler pages deploy dist --project-name doujin-buy-checker
    '';
    deploy-preview.exec = ''
      pnpm build && npx wrangler pages deploy dist --project-name doujin-buy-checker --branch preview
    '';
  };

  processes = {
    dev.exec = "pnpm dev";
  };
}
