
import { useState } from 'react';
import { apiClient, type AnalyzeResponse } from '../api/client';

export const useLegalAssistant = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);

    const analyzeText = async (text: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiClient.ia.analyzeDocument(text);
            setAnalysisResult(result);
            return result;
        } catch (err) {
            setError('Error al conectar con la IA Jurídica');
            console.error(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const ask = async (query: string, context?: string) => {
        // No loading state for chat to allow optimistic UI or separate loading
        try {
            const res = await apiClient.ia.ask(query, context);
            return res;
        } catch (err) {
            console.error(err);
            return { answer: 'Error de conexión' };
        }
    };

    return {
        analyzeText,
        ask,
        isLoading,
        error,
        analysisResult
    };
};
