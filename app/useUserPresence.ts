"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const PRESENCE_COLLECTION = "usuariosEnLinea";
const HEARTBEAT_MS = 15000;
const STALE_AFTER_MS = 45000;

type PresenceData = {
  online?: boolean;
  route?: unknown;
  lastSeen?: unknown;
  updatedAt?: unknown;
};

type PresenceRecord = {
  id: string;
  online: boolean;
  route: string | null;
  lastSeenMs: number;
};

export type OnlineUserCounts = {
  total: number;
  byRoute: Record<string, number>;
  loading: boolean;
};

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timestampToMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function normalizePresenceRecord(id: string, data: PresenceData): PresenceRecord {
  const route = typeof data.route === "string" && data.route.trim()
    ? data.route
    : null;

  return {
    id,
    online: data.online !== false,
    route,
    lastSeenMs:
      timestampToMillis(data.lastSeen) || timestampToMillis(data.updatedAt),
  };
}

function isActive(record: PresenceRecord, now: number) {
  return record.online && record.lastSeenMs > 0 && now - record.lastSeenMs <= STALE_AFTER_MS;
}

function savePresence(sessionId: string, routeName: string | null, online: boolean) {
  const presenceRef = doc(db, PRESENCE_COLLECTION, sessionId);

  return setDoc(
    presenceRef,
    {
      online,
      route: routeName || null,
      lastSeen: Timestamp.now(),
      updatedAt: serverTimestamp(),
      userAgent:
        typeof navigator === "undefined"
          ? null
          : navigator.userAgent.slice(0, 160),
    },
    { merge: true }
  );
}

export function useUserPresence(routeName: string | null) {
  const [sessionId] = useState(createSessionId);
  const routeRef = useRef<string | null>(routeName);

  useEffect(() => {
    routeRef.current = routeName;
    void savePresence(sessionId, routeName, true).catch(() => undefined);
  }, [routeName, sessionId]);

  useEffect(() => {
    const markOnline = () => {
      void savePresence(sessionId, routeRef.current, true).catch(() => undefined);
    };

    const markOffline = () => {
      void savePresence(sessionId, routeRef.current, false).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markOffline();
      } else {
        markOnline();
      }
    };

    markOnline();

    const heartbeat = window.setInterval(markOnline, HEARTBEAT_MS);

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      void deleteDoc(doc(db, PRESENCE_COLLECTION, sessionId)).catch(() => {
        void savePresence(sessionId, routeRef.current, false).catch(() => undefined);
      });
    };
  }, [sessionId]);
}

export function useOnlineUsers(): OnlineUserCounts {
  const [records, setRecords] = useState<PresenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, PRESENCE_COLLECTION), (snapshot) => {
      setRecords(
        snapshot.docs.map((docSnap) =>
          normalizePresenceRecord(docSnap.id, docSnap.data())
        )
      );
      setLoading(false);
      setNow(Date.now());
    });

    return () => unsubscribe();
  }, []);

  return useMemo(() => {
    const byRoute: Record<string, number> = {};
    let total = 0;

    for (const record of records) {
      if (!isActive(record, now)) continue;

      total += 1;

      if (record.route) {
        byRoute[record.route] = (byRoute[record.route] || 0) + 1;
      }
    }

    return {
      total,
      byRoute,
      loading,
    };
  }, [loading, now, records]);
}
