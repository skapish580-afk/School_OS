'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

interface FeatureConfig {
    enabled: boolean;
    sub_features: Record<string, boolean>;
}

// Map of Feature Key -> Config
type FeaturesMap = Record<string, FeatureConfig>;

interface FeatureContextType {
    features: FeaturesMap;
    loading: boolean;
    isFeatureEnabled: (feature: string, subFeature?: string) => boolean;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export function FeatureProvider({ children }: { children: React.ReactNode }) {
    const [features, setFeatures] = useState<FeaturesMap>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeatures();
    }, []);

    const fetchFeatures = async () => {
        try {
            const response = await api.get('/schools/settings/features/');
            setFeatures(response.data);
        } catch (error) {
            console.error('Failed to fetch features:', error);
            // Fallback to core features if API fails
            console.error('Failed to fetch features:', error);
            // On error, do NOT enable everything. 
            // Better to show nothing than to show unauthorized features.
            setFeatures({});
        } finally {
            setLoading(false);
        }
    };

    const isFeatureEnabled = (feature: string, subFeature?: string) => {
        // If loading, assume false or wait? Better to default to false or handle loading state in UI.
        // For simple checks, defaulting to false avoids flickering "allowed" then "denied".
        // But defaulting to true avoids "missing" items briefly.
        // Let's rely on 'features' state.

        const feat = features[feature];
        if (!feat || !feat.enabled) return false;

        if (subFeature) {
            // If sub_feature config has the key, return value.
            // If key is missing, defaults to TRUE (enabled by parent)
            if (feat.sub_features && typeof feat.sub_features[subFeature] !== 'undefined') {
                return feat.sub_features[subFeature];
            }
            return true;
        }
        return true;
    };

    return (
        <FeatureContext.Provider value={{ features, loading, isFeatureEnabled }}>
            {children}
        </FeatureContext.Provider>
    );
}

export function useFeatures() {
    const context = useContext(FeatureContext);
    if (context === undefined) {
        throw new Error('useFeatures must be used within a FeatureProvider');
    }
    return context;
}
