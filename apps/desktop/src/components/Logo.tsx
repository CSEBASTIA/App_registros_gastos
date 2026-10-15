export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/fintrack-app-icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ borderRadius: size * 0.24, display: "block", flexShrink: 0 }}
    />
  );
}
