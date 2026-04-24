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

  processes = {
    dev.exec = "pnpm dev";
  };
}
