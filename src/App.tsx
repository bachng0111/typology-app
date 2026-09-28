import { useMemo } from 'react';
import { parseHash, useHash } from './router';
import HomePage from './pages/HomePage';
import NewBoardPage from './pages/NewBoardPage';
import BoardPage from './pages/BoardPage';
import { ConfirmHost } from './components/ConfirmDialog';
import Toast from './components/Toast';

function Route() {
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  switch (route.name) {
    case 'new':
      return <NewBoardPage />;
    case 'board':
      return <BoardPage key={route.id} id={route.id} />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  return (
    <>
      <Route />
      <ConfirmHost />
      <Toast />
    </>
  );
}
