import RequestForm from './request-form';

// Thin Server Component shell (TRD.md R1) — all state and the POST live in the client
// component below it.
export default function NewRequestPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text">Ajukan Baru</h1>
      <RequestForm />
    </div>
  );
}
