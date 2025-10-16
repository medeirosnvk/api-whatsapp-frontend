module.exports = {
  apps: [
    {
      name: "api-whatsapp-frontend",
      script: "node",
      args: "./build/server/index.js", // Arquivo gerado após o build
      cwd: "/home/deploy/api-whatsapp-frontend", // opcional, mas recomendado
      env: {
        NODE_ENV: "production",
        PORT: 5175,
      },
    },
  ],
};
