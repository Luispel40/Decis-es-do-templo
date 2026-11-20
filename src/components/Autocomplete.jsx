import { useEffect, useRef, useState } from 'react';

/**
 * Campo com preenchimento automático que só aceita itens da lista (vindos do banco).
 * value: item selecionado ({id, nome}) ou null. onChange recebe o item ou null.
 */
export default function Autocomplete({ itens, value, onChange, placeholder, id }) {
  const [texto, setTexto] = useState(value ? value.nome : '');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef(null);

  // só sincroniza quando há seleção; ao digitar (value = null) o texto digitado é preservado
  useEffect(() => { if (value) setTexto(value.nome); }, [value]);

  useEffect(() => {
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtrados = itens.filter((i) => norm(i.nome).includes(norm(texto))).slice(0, 8);

  const escolher = (item) => {
    onChange(item);
    setTexto(item.nome);
    setAberto(false);
  };

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo((a) => Math.min(a + 1, filtrados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && aberto && filtrados[ativo]) { e.preventDefault(); escolher(filtrados[ativo]); }
    else if (e.key === 'Escape') setAberto(false);
  };

  return (
    <div className="auto" ref={ref}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        value={texto}
        placeholder={placeholder}
        onFocus={() => setAberto(true)}
        onKeyDown={teclas}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
          setAtivo(0);
          if (value) onChange(null); // digitar invalida a seleção até escolher na lista
        }}
      />
      {aberto && (
        <ul className="auto-lista" role="listbox">
          {filtrados.length === 0 && <li className="auto-vazio">Nenhuma unidade encontrada</li>}
          {filtrados.map((i, idx) => (
            <li
              key={i.id}
              role="option"
              aria-selected={idx === ativo}
              className={idx === ativo ? 'ativo' : ''}
              onMouseDown={(e) => { e.preventDefault(); escolher(i); }}
            >
              {i.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
