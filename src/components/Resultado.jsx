import { pct } from '../utils.js';

/** Barras simples de resultado (percentual por opção). */
export default function Resultado({ pauta }) {
  return (
    <ul className="barras">
      {pauta.opcoes.map((o) => {
        const n = pauta.totais[o] || 0;
        const venc = pauta.encerrada && pauta.vencedoras.includes(o);
        return (
          <li key={o} className={venc ? 'venc' : ''}>
            <div className="barra-topo">
              <span>{venc && '✓ '}{o}</span>
              <span>{n} voto{n === 1 ? '' : 's'} · {pct(n, pauta.totalVotos)}%</span>
            </div>
            <div className="barra-trilho"><div className="barra-preench" style={{ width: pct(n, pauta.totalVotos) + '%' }} /></div>
          </li>
        );
      })}
    </ul>
  );
}
