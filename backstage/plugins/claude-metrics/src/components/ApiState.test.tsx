import { ResponseError } from '@backstage/errors';
import { render, screen } from '@testing-library/react';
import { ApiState } from './ApiState';

async function responseError(status: number, message: string) {
  const res = new Response(
    JSON.stringify({
      error: { name: 'InputError', message },
      response: { statusCode: status },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
  return ResponseError.fromResponse(res);
}

describe('ApiState', () => {
  it('shows the server error message', async () => {
    const error = await responseError(400, 'from must be on or before to');
    render(
      <ApiState state={{ loading: false, error }}>
        {() => <p>data</p>}
      </ApiState>,
    );
    expect(
      screen.getByText(/from must be on or before to/),
    ).toBeInTheDocument();
    expect(screen.queryByText('data')).not.toBeInTheDocument();
  });

  it('shows a progress indicator while loading', () => {
    render(<ApiState state={{ loading: true }}>{() => <p>data</p>}</ApiState>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders children with the value', () => {
    render(
      <ApiState state={{ loading: false, value: 42 }}>
        {v => <p>value {v}</p>}
      </ApiState>,
    );
    expect(screen.getByText('value 42')).toBeInTheDocument();
  });
});
