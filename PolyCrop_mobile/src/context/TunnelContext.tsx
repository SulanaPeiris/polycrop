import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Tunnel {
    id: string;
    name: string;
    status: "GOOD" | "WARN" | "ERROR";
    cropType?: string;
    rows?: number;
    columns?: number;
    size?: string;
    sensorCount?: number;
    robotId?: string;
    fertigationUnitId?: string;
    sensors?: {
        temp?: number;
        humidity?: number;
        soil?: number;
    };
}

interface TunnelContextType {
    tunnels: Tunnel[];
    selectedTunnelId: string;
    setSelectedTunnelId: (id: string) => void;
    selectedTunnel: Tunnel | undefined;
    addTunnel: (tunnel: Omit<Tunnel, 'id' | 'status'>) => void;
}

const TunnelContext = createContext<TunnelContextType | undefined>(undefined);

export function TunnelProvider({ children }: { children: ReactNode }) {
    const [tunnels, setTunnels] = useState<Tunnel[]>([
        { id: "1", name: "Tunnel A", status: "GOOD", cropType: "Cucumber", rows: 10, columns: 20, size: "500 m²", sensorCount: 8, robotId: "R-001", fertigationUnitId: "F-001", sensors: { temp: 24.5, humidity: 65, soil: 40 } },
        { id: "2", name: "Tunnel B", status: "WARN", cropType: "Tomato", rows: 8, columns: 15, size: "350 m²", sensorCount: 6, robotId: "R-002", fertigationUnitId: "F-002", sensors: { temp: 28.0, humidity: 70, soil: 35 } },
        { id: "3", name: "Tunnel C", status: "GOOD", cropType: "Lettuce", rows: 12, columns: 25, size: "600 m²", sensorCount: 10, robotId: "R-003", fertigationUnitId: "F-003", sensors: { temp: 23.0, humidity: 60, soil: 45 } },
    ]);
    const [selectedTunnelId, setSelectedTunnelId] = useState("1");

    const selectedTunnel = tunnels.find((t) => t.id === selectedTunnelId);

    const addTunnel = (tunnel: Omit<Tunnel, 'id' | 'status'>) => {
        const newTunnel: Tunnel = {
            ...tunnel,
            id: Date.now().toString(),
            status: "GOOD",
        };
        setTunnels([...tunnels, newTunnel]);
        setSelectedTunnelId(newTunnel.id);
    };

    return (
        <TunnelContext.Provider
            value={{
                tunnels,
                selectedTunnelId,
                setSelectedTunnelId,
                selectedTunnel,
                addTunnel,
            }}
        >
            {children}
        </TunnelContext.Provider>
    );
}

export function useTunnel() {
    const context = useContext(TunnelContext);
    if (!context) {
        throw new Error("useTunnel must be used within TunnelProvider");
    }
    return context;
}
