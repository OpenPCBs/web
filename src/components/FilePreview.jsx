import { useEffect, useRef } from 'react';

function drawGerberPreview(canvas, renderData) {
  if (!canvas || !renderData) return;

  const ctx = canvas.getContext('2d');
  const { minX, minY, maxX, maxY } = renderData.bounds;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = 18;
  const scale = Math.min((canvas.width - padding * 2) / width, (canvas.height - padding * 2) / height);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a1b18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(padding, canvas.height - padding);
  ctx.scale(scale, -scale);
  ctx.translate(-minX, -minY);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8af3c4';
  ctx.fillStyle = '#8af3c4';

  for (const command of renderData.commands) {
    ctx.lineWidth = Math.max(command.width / 1000, 0.5 / scale);
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.stroke();
  }

  for (const flash of renderData.flashes) {
    const radius = Math.max(flash.r / 2000, 0.8 / scale);
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#6fd4ff';
  for (const drill of renderData.drills) {
    const radius = Math.max(drill.r / 2000, 0.8 / scale);
    ctx.beginPath();
    ctx.arc(drill.x, drill.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function FilePreview({ preview }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (preview?.render && (preview.kind === 'gerber' || preview.kind === 'drill')) {
      drawGerberPreview(canvasRef.current, preview.render);
    }
  }, [preview]);

  useEffect(() => {
    return () => {
      if (preview?.objectUrl) {
        URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [preview]);

  if (!preview) return null;

  return (
    <div className="file-preview-card">
      <div className="file-preview-header">
        <div>
          <strong>Upload preview</strong>
          <p>{preview.name}</p>
        </div>
        <span className="chip chip-muted">{preview.kind}</span>
      </div>

      {preview.kind === 'image' ? <img className="file-preview-image" src={preview.objectUrl} alt={preview.name} /> : null}

      {preview.kind === 'pdf' ? <iframe className="file-preview-frame" title={preview.name} src={preview.objectUrl} /> : null}

      {(preview.kind === 'gerber' || preview.kind === 'drill') ? (
        <>
          <canvas ref={canvasRef} className="gerber-preview-canvas" width="760" height="460" />
          <div className="preview-pill-row">
            {preview.notes?.map((note) => (
              <span key={note} className="tag">{note}</span>
            ))}
          </div>
        </>
      ) : null}

      {preview.kind === 'schematic' ? (
        <div className="structured-preview">
          <div className="preview-pill-row">
            {preview.render.metrics.map((metric) => (
              <span key={metric} className="tag">{metric}</span>
            ))}
          </div>
          {preview.render.refs.length ? (
            <div>
              <p className="preview-subtitle">Detected references</p>
              <div className="preview-pill-row">
                {preview.render.refs.map((ref) => (
                  <span key={ref} className="chip chip-muted">{ref}</span>
                ))}
              </div>
            </div>
          ) : null}
          <pre className="code-preview">{preview.render.excerpt}</pre>
        </div>
      ) : null}

      {preview.kind === 'board' ? (
        <div className="structured-preview">
          <div className="preview-pill-row">
            {preview.render.metrics.map((metric) => (
              <span key={metric} className="tag">{metric}</span>
            ))}
          </div>
          <pre className="code-preview">{preview.render.excerpt}</pre>
        </div>
      ) : null}

      {(preview.kind === 'text' || preview.kind === 'zip') ? (
        <div className="structured-preview">
          {preview.notes?.length ? (
            <div className="preview-pill-row">
              {preview.notes.map((note) => (
                <span key={note} className="tag">{note}</span>
              ))}
            </div>
          ) : null}
          {preview.text ? <pre className="code-preview">{preview.text.slice(0, 2400)}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

export default FilePreview;
