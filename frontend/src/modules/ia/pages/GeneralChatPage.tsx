import { useLocation } from 'react-router-dom';
import { AIChatWidget } from '../../expedientes/components/AIChatWidget';
import { Bot } from 'lucide-react';

export const GeneralChatPage = () => {
    const location = useLocation();
    const falloContext = location.state?.fallo;

    // Usamos un ID constante para el chat general del usuario
    const generalChatId = 'general-workspace-user';

    return (
        <div className="animate-fade-in flex flex-col p-6 max-w-5xl mx-auto h-full gap-6 box-border">
            <header className="flex items-center gap-4">
                <div className="p-3 rounded-lg flex items-center justify-center bg-blue-100 text-blue-700" style={{ backgroundColor: 'hsl(var(--hsl-primary) / 0.1)', color: 'hsl(var(--hsl-primary))' }}>
                    <Bot size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Asistente Legal General</h1>
                    <p className="text-muted text-sm">Consultas doctrinarias, análisis de fallos y redacción fuera de expediente.</p>
                </div>
            </header>

            <div className="flex-1 rounded-xl border overflow-hidden shadow-sm flex flex-col bg-white" style={{ borderColor: 'hsl(var(--hsl-border))', height: 'calc(100vh - 200px)' }}>
                <AIChatWidget
                    expedienteId={generalChatId}
                    initialMessage={falloContext ?
                        `Analiza el siguiente fallo que estoy investigando:\n\n**${falloContext.caratula}**\n*${falloContext.tribunal}, ${falloContext.fecha || 'Fecha N/D'}*\n\n${falloContext.resumen || 'Sin resumen disponible.'}\n\n¿Qué implicancias tiene este fallo y cómo se relaciona con la jurisprudencia actual?`
                        : undefined}
                />
            </div>
        </div>
    );
};
