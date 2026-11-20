import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PrimeiroAcesso from './pages/PrimeiroAcesso.jsx';
import Inicio from './pages/Inicio.jsx';
import Pautas from './pages/Pautas.jsx';
import Graficos from './pages/Graficos.jsx';
import Calendario from './pages/Calendario.jsx';
import Prestacoes from './pages/Prestacoes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Configuracoes from './pages/Configuracoes.jsx';

export default function App() {
  const { usuario, carregando, can } = useAuth();

  if (carregando) return <div className="tela-central"><p className="muted">Carregando…</p></div>;
  if (!usuario) return <Login />;
  if (usuario.primeiroAcesso) return <PrimeiroAcesso />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/pautas" element={<Pautas />} />
        <Route path="/graficos" element={<Graficos />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/prestacoes" element={<Prestacoes />} />
        {can('gerenciar_usuarios') && <Route path="/usuarios" element={<Usuarios />} />}
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
