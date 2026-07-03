type StatusBannerProps = {
  feedback: string;
  error: string;
};

export function StatusBanner({ feedback, error }: StatusBannerProps) {
  if (!feedback && !error) {
    return null;
  }

  return (
    <section className={`banner glass-panel${error ? " is-danger" : " is-success"}`}>
      {error || feedback}
    </section>
  );
}
