"use client";

export type SemanaAvanceSeleccionable = {
  id: string;
  numero: number;
  semana: string;
  fechas: string;
  unidadTema: string;
  subtemas: string[];
  temaCompleto: string;
};

type Props = {
  semanas: SemanaAvanceSeleccionable[];
  seleccionadas: string[];
  onToggleSemana: (id: string) => void;
  onContinuar: () => void;
  onCancelar: () => void;
};

const MAX_SEMANAS_AVANCE = 4;

export default function SeleccionSemanasAvance({
  semanas,
  seleccionadas,
  onToggleSemana,
  onContinuar,
  onCancelar,
}: Props) {
  const puedeContinuar =
    seleccionadas.length > 0 && seleccionadas.length <= MAX_SEMANAS_AVANCE;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45d]">
            Avance Programatico F-51
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#071a33]">
            Seleccionar semanas del avance
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Selecciona hasta cuatro semanas. El periodo reportado se construira
            con esta seleccion.
          </p>
        </div>

        <div className="rounded-2xl bg-[#071a33] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white">
          {seleccionadas.length}/{MAX_SEMANAS_AVANCE}
        </div>
      </div>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {semanas.map((semana) => {
          const activa = seleccionadas.includes(semana.id);
          const bloqueada =
            !activa && seleccionadas.length >= MAX_SEMANAS_AVANCE;

          return (
            <label
              key={semana.id}
              className={`block rounded-2xl border p-4 transition ${
                activa
                  ? "border-[#c8a45d] bg-[#fffaf0] shadow-sm"
                  : "border-slate-200 bg-white hover:border-[#c8a45d]/70"
              } ${bloqueada ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
            >
              <div className="flex gap-4">
                <input
                  type="checkbox"
                  checked={activa}
                  disabled={bloqueada}
                  onChange={() => onToggleSemana(semana.id)}
                  className="mt-1 h-5 w-5 accent-[#071a33]"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-[#071a33]">
                      Semana {semana.numero}
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      {semana.fechas || semana.semana}
                    </p>
                  </div>

                  <p className="mt-3 text-sm font-black text-[#071a33]">
                    {semana.unidadTema}
                  </p>

                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {semana.subtemas.map((subtema) => (
                      <li key={subtema}>{subtema}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-2xl border border-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-[#071a33] transition hover:bg-[#071a33] hover:text-white"
        >
          Volver
        </button>

        <button
          type="button"
          onClick={onContinuar}
          disabled={!puedeContinuar}
          className="rounded-2xl bg-[#071a33] px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-slate-300/70 transition hover:bg-[#0b2a52] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
        >
          Continuar a vista previa
        </button>
      </div>
    </div>
  );
}
