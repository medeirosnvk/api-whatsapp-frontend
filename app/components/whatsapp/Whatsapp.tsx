import axios from "axios";
import { useEffect, useRef, useState } from "react";

interface Connection {
  success: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    api: string;
    createdAt: string;
    qrcode?: string;
  };
}

interface Message {
  text: string;
  type: "success" | "connecting" | "error" | "info";
}

export default function WhatsAppConnections() {
  const [connectionName, setConnectionName] = useState("");
  const [selectedApi, setSelectedApi] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [showQrModal, setShowQrCodeModal] = useState(false);
  const [qrBase64, setQrBase64] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [currentConnectionId, setCurrentConnectionId] = useState<number | null>(
    null
  );
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hostApiList, setHostApiList] = useState<string[]>([
    "http://localhost:3020",
  ]);

  // http://191.101.70.186:3080

  // useEffect(() => {
  //   const fetchHostsConnections = async () => {
  //     try {
  //       const response = await axios.get(
  //         `https://api.cobrance.online:3030/frontend/listHostsConnections`
  //       );

  //       const listHosts = response.data;
  //       setHostApiList(listHosts);
  //     } catch (error) {
  //       console.error("Erro ao buscar lista de hosts:", error);
  //     }
  //   };

  //   fetchHostsConnections();
  // }, []);

  const handleCreateConnection = async () => {
    if (!connectionName.trim()) {
      setMessage({
        text: "Por favor, insira um nome para a conexão",
        type: "error",
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    if (!selectedApi) {
      setMessage({ text: "Por favor, selecione uma API", type: "error" });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${selectedApi}/instance/create`, {
        instanceName: connectionName,
      });

      if (response.status !== 200 || response.data.data === 0) {
        console.error("Erro ao buscar status da conexao:", response);
        setMessage({
          text: "Erro ao buscar status da conexao. Por favor, tente novamente.",
          type: "error",
        });
        setTimeout(() => setMessage(null), 5000);
        setLoading(false);
        return;
      }

      const newConnection = response.data;
      console.log("newConnection -", newConnection);

      setConnections((prev) => [...prev, newConnection]);
      setConnectionName(String(newConnection.data.id));
      setSelectedApi(selectedApi);
      setCurrentConnectionId(newConnection.data.id);
      setLoading(false);
      setTimeout(() => {
        setShowQrCodeModal(true);
        fethQRCode(newConnection);
      }, 1000);
    } catch (error) {
      console.error("Erro ao buscar status da conexao:", error);
    }
  };

  const fethQRCode = async (connection: Connection) => {
    setQrLoading(true);

    try {
      const response = await axios.get(
        `${selectedApi}/instance/connect/${connection.data.id}`
      );
      console.log("response -", response);

      if (response.status !== 200 || response.data.data === 0) {
        setMessage({
          text: "Nao foi possivel gerar o QRCode. Por favor, tente novamente.",
          type: "error",
        });
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      const newQrBase64 = response.data;
      console.log("newQrBase64 -", newQrBase64);

      console.log("Sucesso ao buscar imagem base64 do QRCode", newQrBase64);
      setQrBase64(newQrBase64.base64);
      setQrLoading(false);
      startStatusCheck(connection);
    } catch (error) {
      console.error("Erro ao gerar QR code.");
      setMessage({ text: "Erro ao gerar QR code", type: "error" });
      setQrLoading(false);
      setShowQrCodeModal(false);
    }
  };

  const startStatusCheck = (connection: Connection) => {
    // 🧹 Se já existe um loop rodando, limpa antes
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }

    console.log("🚀 Iniciando monitoramento da conexão...");

    statusCheckIntervalRef.current = setInterval(async () => {
      await checkConnectionStatus(connection);
    }, 5000);
  };

  const checkConnectionStatus = async (connection: Connection) => {
    try {
      const response = await axios.get(
        `${selectedApi}/instance/connectionState/${connection.data.id}`
      );

      const connectionState = response.data;
      console.log("newStatusConnection -", connectionState);

      if (connectionState.state === "open") {
        console.log("✅ Conexão aberta, parando o loop imediatamente...");

        // ✅ Para o loop de forma garantida
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }

        const response = await axios.post(
          `https://api.cobrance.online:3030/frontend/updateStatusConnection`,
          {
            nome: connection.data.id,
            status: connectionState.state,
            host: selectedApi,
          }
        );

        if (response.status !== 200) {
          console.error("Erro ao atualizar status no banco:", response);
          setMessage({
            text: "Erro ao atualizar status no banco. Por favor, tente novamente.",
            type: "error",
          });
          setTimeout(() => setMessage(null), 5000);
          return;
        }

        console.log("Status atualizado no banco com sucesso");

        // Atualiza o status dentro do objeto `data` da conexão correspondente
        setConnections((prevConnections) =>
          prevConnections.map((conn) =>
            conn.data.id === connection.data.id
              ? { ...conn, data: { ...conn.data, status: "open" } }
              : conn
          )
        );

        setShowQrCodeModal(false);
        setQrBase64("");
        setCurrentConnectionId(null);
        setMessage({ text: "Conexão aberta com sucesso!", type: "success" });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const handleDeleteConnection = (id: number) => {
    setConnections(connections.filter((conn) => conn.data.id !== id));
    setMessage({ text: "Conexão removida", type: "info" } as any);
    setTimeout(() => setMessage(null), 5000);
  };

  const closeQrModal = () => {
    console.log("🧹 Fechando modal e limpando intervalo...");

    setShowQrCodeModal(false);
    setQrBase64("");

    // ✅ Para o loop de checagem imediatamente, se existir
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }

    // ✅ Remove a conexão se o usuário cancelar
    setConnections((prevConnections) =>
      prevConnections.filter((conn) => conn.data.id !== currentConnectionId)
    );

    setCurrentConnectionId(null);
  };

  return (
    <main className="flex items-center justify-center pt-16 pb-4 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="flex-1 flex flex-col items-center gap-8 min-h-0 max-w-4xl w-full px-4">
        {/* Header */}
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold text-white">Whatsapp Connect</h1>
          <p className="text-slate-400">Gerenciador de conexões WhatsApp</p>
        </header>

        {/* Form */}
        <div className="w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-8 space-y-6">
          {/* Nome da Conexão */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Nome da Conexão
            </label>
            <input
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="Ex: Conexão Principal"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* API Selection Table */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Selecione a URL da API
            </label>
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-200">
                      Selecionar
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-200">
                      URL da API
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-200">
                      Porta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hostApiList.map((api, index) => {
                    const port = api.split(":")[2];
                    return (
                      <tr
                        key={api}
                        className={`border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer ${
                          index === hostApiList.length - 1 ? "border-b-0" : ""
                        } ${selectedApi === api ? "bg-slate-700" : "bg-slate-800"}`}
                        onClick={() => setSelectedApi(api)}
                      >
                        <td className="px-6 py-3">
                          <input
                            type="radio"
                            name="api-selection"
                            checked={selectedApi === api}
                            onChange={() => setSelectedApi(api)}
                            className="w-4 h-4 accent-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3 text-slate-300 font-mono text-sm">
                          {api}
                        </td>
                        <td className="px-6 py-3 text-slate-400 text-sm">
                          :{port}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateConnection}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {loading ? "Criando..." : "Criar Nova Conexão"}
          </button>

          {/* Messages */}
          {message && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-green-900 text-green-200 border border-green-700"
                  : message.type === "error"
                    ? "bg-red-900 text-red-200 border border-red-700"
                    : "bg-blue-900 text-blue-200 border border-blue-700"
              }`}
            >
              {message.type === "success" ? (
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : message.type === "error" ? (
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : null}
              {message.text}
            </div>
          )}
        </div>

        {/* Connections List */}
        <div className="w-full">
          <h2 className="text-2xl font-bold text-white mb-4">
            Conexões abertas
          </h2>
          {connections.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow p-12 text-center">
              <p className="text-slate-400 text-lg">
                Nenhuma conexão criada ainda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((connection) => (
                <div
                  key={connection.data.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg shadow-md p-6 space-y-4 border-l-4 "
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {connection.data.id}
                      </h3>
                      <p className="text-sm text-slate-400 break-all font-mono">
                        {connection.data.api}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                        connection.data.status === "open"
                          ? "bg-green-900 text-green-200 border-green-700"
                          : "bg-yellow-900 text-yellow-200 border-yellow-700"
                      }`}
                    >
                      {connection.data.status === "open"
                        ? "Open"
                        : "Conectando..."}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-500">
                      Criado em: {connection.data.createdAt}
                    </p>
                    {connection.data.status === "open" && (
                      <button
                        onClick={() =>
                          handleDeleteConnection(connection.data.id)
                        }
                        className="text-red-400 hover:text-red-300 transition-colors p-2"
                        title="Deletar conexão"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-2 text-sm text-slate-500 mt-8">
          <p>Gerenciador de Conexões WhatsApp API</p>
          <p className="text-xs">© 2025 - Todos os direitos reservados</p>
        </footer>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white text-center">
              Autenticar WhatsApp
            </h2>

            {/* QR Code Loading */}
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-16 h-16 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-slate-300 text-center">Gerando QR Code...</p>
              </div>
            ) : (
              <>
                {/* QR Code Display */}
                <div className="flex justify-center p-6 bg-white rounded-lg">
                  <img src={qrBase64} alt="QR Code" className="w-48 h-48" />
                </div>

                {/* Instructions */}
                <div className="bg-slate-700 border border-slate-600 rounded-lg p-4 text-center">
                  <p className="text-slate-200 text-sm">
                    Abra o WhatsApp no seu telefone e escaneie o código QR acima
                    para autenticar a conexão.
                  </p>
                  <p className="text-slate-400 text-xs mt-2">
                    Aguardando confirmação...
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeQrModal}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
