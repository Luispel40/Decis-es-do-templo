export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const PERMISSOES = {
  votar: 'Votar nas pautas',
  criar_pauta: 'Criar sugestões/pautas',
  comentar: 'Comentar prestações de contas',
  enviar_prestacao: 'Enviar prestação de contas',
  gerenciar_usuarios: 'Gerenciar usuários da unidade'
};

export const PAPEIS = { admin: 'Administrador', responsavel: 'Responsável', membro: 'Membro' };

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtData(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function fmtMes(ym) {
  if (!ym) return '—';
  const [a, m] = ym.split('-');
  return `${MESES[Number(m) - 1]} de ${a}`;
}

export function fmtDataHora(iso) {
  if (!iso) return '';
  return `${fmtData(iso)} ${String(iso).slice(11, 16)}`;
}

export function pct(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

export function textoResultado(p) {
  if (p.resultado === 'sem_votos') return 'Encerrada sem votos';
  if (p.resultado === 'empate') return `Empate: ${p.vencedoras.join(' / ')}`;
  if (p.resultado === 'definida') return p.vencedoras[0];
  return 'Em votação';
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

export function baixarBase64({ base64, mimeType, nomeArquivo }) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
