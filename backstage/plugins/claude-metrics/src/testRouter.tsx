import { useLocation, useNavigate } from 'react-router-dom';

/** Test helper: exposes the router's current URL and navigate function to the test body. */
export const router: {
  search: () => URLSearchParams;
  navigate: (to: string) => void;
} = {
  search: () => new URLSearchParams(),
  navigate: () => {},
};

export function RouterSpy() {
  const location = useLocation();
  const navigate = useNavigate();
  router.search = () => new URLSearchParams(location.search);
  router.navigate = (to: string) => navigate(to, { replace: true });
  return null;
}
