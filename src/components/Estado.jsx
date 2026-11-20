/** Mostra carregando / erro padronizados. Retorna null quando está tudo certo. */
export default function Estado({ carregando, erro, onRetry, vazio }) {
  if (carregando) return <p className="muted">Carregando…</p>;
  if (erro) {
    return (
      <div className="aviso aviso-erro" role="alert">
        {erro} {onRetry && <button className="link" onClick={onRetry}>Tentar de novo</button>}
      </div>
    );
  }
  if (vazio) return <p className="muted vazio">{vazio}</p>;
  return null;
}
