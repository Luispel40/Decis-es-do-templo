import { useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePautas } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import { fmtData, pct, textoResultado } from '../utils.js';

function GraficoPauta({ p }) {
  const dados = p.opcoes.map((o) => ({ opcao: o, votos: p.totais[o] || 0, pct: pct(p.totais[o] || 0, p.totalVotos) }));
  const lider = Math.max(...dados.map((d) => d.votos));
  const participacao = pct(p.totalVotos, p.elegiveis);
  const altura = Math.max(120, dados.length * 48 + 20);

  return (
    <article className="cartao">
      <div className="cartao-topo">
        <h3>{p.titulo}</h3>
        <span className={'selo ' + (p.encerrada ? 'selo-neutro' : 'selo-ok')}>{p.encerrada ? textoResultado(p) : 'Em votação'}</span>
      </div>
      <p className="muted pequeno">
        {p.unidadeNome} · {p.encerrada ? `decidida em ${fmtData(p.dataDecisao)}` : `até ${fmtData(p.prazo)}`}
      </p>

      <div className="partic">
        <div className="barra-topo"><span>Participação</span><span>{p.totalVotos} de {p.elegiveis} ({participacao}%)</span></div>
        <div className="barra-trilho"><div className="barra-preench neutra" style={{ width: Math.min(participacao, 100) + '%' }} /></div>
      </div>

      <div style={{ width: '100%', height: altura }} role="img" aria-label={`Gráfico de votos: ${dados.map((d) => `${d.opcao} ${d.votos}`).join(', ')}`}>
        <ResponsiveContainer>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis type="category" dataKey="opcao" width={110} tick={{ fill: 'currentColor', fontSize: 13 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, _n, item) => [`${v} voto${v === 1 ? '' : 's'} (${item.payload.pct}%)`, 'Total']} cursor={{ fill: 'rgba(127,127,127,.12)' }} />
            <Bar dataKey="votos" radius={[0, 6, 6, 0]} barSize={26}>
              {dados.map((d) => <Cell key={d.opcao} fill={d.votos === lider && lider > 0 ? 'var(--cor-destaque)' : 'var(--cor-barra)'} />)}
              <LabelList dataKey="votos" position="right" formatter={(v) => v} fill="currentColor" fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* tabela acessível equivalente ao gráfico */}
      <details>
        <summary>Ver em tabela</summary>
        <table className="tabela">
          <thead><tr><th>Opção</th><th>Votos</th><th>%</th></tr></thead>
          <tbody>{dados.map((d) => <tr key={d.opcao}><td>{d.opcao}</td><td>{d.votos}</td><td>{d.pct}%</td></tr>)}</tbody>
        </table>
      </details>
    </article>
  );
}

export default function Graficos() {
  const { dados: pautas, erro, carregando, recarregar } = usePautas();
  const [aba, setAba] = useState('abertas');
  const lista = (pautas || []).filter((p) => (aba === 'abertas' ? !p.encerrada : p.encerrada));

  return (
    <>
      <h1>Gráficos das pautas</h1>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={aba === 'abertas'} className={aba === 'abertas' ? 'ativa' : ''} onClick={() => setAba('abertas')}>Abertas</button>
        <button role="tab" aria-selected={aba === 'encerradas'} className={aba === 'encerradas' ? 'ativa' : ''} onClick={() => setAba('encerradas')}>Encerradas</button>
      </div>
      <Estado carregando={carregando} erro={erro} onRetry={recarregar} vazio={pautas && lista.length === 0 ? 'Nenhuma pauta para exibir.' : ''} />
      <div className="grade">{lista.map((p) => <GraficoPauta key={p.id} p={p} />)}</div>
    </>
  );
}
