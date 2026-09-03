import Admin from './Admin';
import App from './App';

export default function Root() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <App />;
}
