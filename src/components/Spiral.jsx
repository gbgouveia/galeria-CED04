/**
 * Espiral em traço fino, inspirada nas pinturas corporais brancas das fotografias do ensaio.
 * Elemento decorativo: oculto para leitores de tela.
 */
export function Spiral({ className = '', turns = 4, strokeWidth = 1 }) {
  const points = [];
  const steps = turns * 64;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / 64) * Math.PI * 2;
    const radius = 2 + (i / steps) * 46;
    points.push(`${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return (
    <svg className={`spiral ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
