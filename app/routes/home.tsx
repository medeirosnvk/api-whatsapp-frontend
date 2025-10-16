import WhatsAppConnections from "~/components/whatsapp/Whatsapp";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Whatsapp Connect" },
    { name: "description", content: "Bem vindo a API Whatsapp!" },
  ];
}

export default function Home() {
  return <WhatsAppConnections />;
}
