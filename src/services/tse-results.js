const endpoint = "/api/eleicoes/segundo-turno";

export async function loadElectionSnapshot(coverage, { signal, refresh = false } = {}) {
  const query = new URLSearchParams({ abrangencia: coverage });
  if (refresh) query.set("atualizar", "1");

  const response = await fetch(`${endpoint}?${query}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.message || `O servidor respondeu com status ${response.status}.`);
  }

  return response.json();
}
