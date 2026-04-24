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
