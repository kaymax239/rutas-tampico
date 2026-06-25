"use client";

import type { SemanaAvanceSeleccionable } from "./SeleccionSemanasAvance";

type Props = {
  materia: string;
  carrera: string;
  semestre: string;
  semanas: SemanaAvanceSeleccionable[];
  generando: boolean;
  onVolver: () => void;
  onGenerar: () => void;
};

export default function VistaPreviaAvance({
  materia,
  carrera,
  semestre,
  semanas,
  generando,
  onVolver,
  onGenerar,
}: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
          Vista previa F-51
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#071a33]">
          Avance Programatico
        </h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Materia
          </p>
          <p className="mt-2 text-sm font-black text-[#071a33]">{materia}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Carrera
          </p>
          <p className="mt-2 text-sm font-black text-[#071a33]">{carrera}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Semestre
          </p>
          <p className="mt-2 text-sm font-black text-[#071a33]">{semestre}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {semanas.map((semana) => (
          <article
            key={semana.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#071a33]">
                Semana {semana.numero}
              </h3>
              <p className="text-sm font-bold text-slate-500">
                {semana.fechas || semana.semana}
              </p>
            </div>

            <p className="mt-3 text-sm font-black text-[#071a33]">
              {semana.unidadTema}
            </p>
            <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
              {semana.subtemas.join("\n")}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onVolver}
          disabled={generando}
          className="rounded-2xl border border-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cambiar semanas
        </button>

        <button
          type="button"
          onClick={onGenerar}
          disabled={generando}
          className="rounded-2xl bg-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-300/70 transition hover:bg-[#0b2a52] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          {generando ? "Generando Word F-51..." : "Generar Word F-51"}
        </button>
      </div>
    </div>
  );
}
