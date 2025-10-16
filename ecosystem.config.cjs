module.exports = {
  apps: [
    {
      name: "api-whatsapp-frontend",
      script: "npm",
      args: "run start", // roda 'npm run start'
      cwd: "/home/deploy/api-whatsapp-frontend", // diretório do projeto
      env: {
        NODE_ENV: "production",
        PORT: 5175,
      },
    },
  ],
};
