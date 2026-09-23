import React, { useCallback, useState } from 'react';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { IconEyeOpened, IconMaximize } from '@douyinfe/semi-icons';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';

const BG_COLORS: { labelKey: MessageKey; value: string }[] = [
  { labelKey: 'bg.lightGray', value: '#e8e8e8' },
  { labelKey: 'bg.darkGray', value: '#2d2d2d' },
  { labelKey: 'bg.black', value: '#111111' },
];

const PresetViewButtons: React.FC = () => {
  const t = useT();
  const [pinned, setPinned] = useState(true);
  const [hover, setHover] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showDims, setShowDims] = useState(true);
  const [showShelfIds, setShowShelfIds] = useState(true);
  const show = pinned || hover;

  const handleReset = useCallback(() => {
    window.dispatchEvent(new CustomEvent('reset-camera'));
  }, []);

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const el = document.querySelector('canvas')?.parentElement;
      if (el) el.requestFullscreen();
    }
  }, []);

  const handleColorSelect = useCallback((color: string) => {
    window.dispatchEvent(new CustomEvent('set-bg', { detail: { color } }));
    setShowColors(false);
  }, []);

  const toggleDim = useCallback(() => {
    setShowDims((v) => {
      const next = !v;
      window.dispatchEvent(new CustomEvent('set-show-dims', { detail: { show: next } }));
      return next;
    });
  }, []);

  const toggleShelfId = useCallback(() => {
    setShowShelfIds((v) => {
      const next = !v;
      window.dispatchEvent(new CustomEvent('set-show-shelf-ids', { detail: { show: next } }));
      return next;
    });
  }, []);

  const btnStyle = { borderRadius: 6, padding: '4px 10px', fontSize: 12 };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!pinned && (
        <div style={{ width: 40, height: 4, borderRadius: '0 0 3px 3px', background: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }} />
      )}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: pinned ? 8 : '0 0 8px 8px',
          border: '1px solid rgba(255,255,255,0.12)',
          borderTop: pinned ? '1px solid rgba(255,255,255,0.12)' : 'none',
          transform: show ? 'translateY(0)' : 'translateY(-100%)',
          opacity: show ? 1 : 0,
          transition: 'transform 0.2s ease, opacity 0.15s ease',
          pointerEvents: show ? 'auto' : 'none',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Tooltip content={t('tip.resetView')}>
          <Button theme="solid" type="primary" icon={<IconEyeOpened size="small" />} onClick={handleReset} style={btnStyle} />
        </Tooltip>
        <Tooltip content={t('tip.fullscreen')}>
          <Button theme="solid" type="primary" icon={<IconMaximize size="small" />} onClick={handleFullscreen} style={btnStyle} />
        </Tooltip>
        <Tooltip content={t('tip.background')}>
          <Button
            theme="solid"
            type="primary"
            onClick={() => setShowColors(!showColors)}
            style={{ ...btnStyle, fontFamily: 'serif', fontWeight: 700, fontSize: 14, position: 'relative' }}
          >
            ◐
          </Button>
        </Tooltip>
        {/* 颜色选择下拉 */}
        {showColors && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 4,
              display: 'flex',
              gap: 6,
              padding: '6px 10px',
              background: 'rgba(40,40,40,0.9)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {BG_COLORS.map((c) => (
              <Tooltip key={c.value} content={t(c.labelKey)}>
                <div
                  onClick={() => handleColorSelect(c.value)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    border: '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                />
              </Tooltip>
            ))}
          </div>
        )}
        <Tooltip content={t('tip.markerToggle')}>
          <Button
            theme="solid"
            type="primary"
            onClick={() => setShowLabels(!showLabels)}
            style={{ ...btnStyle, fontWeight: 600, fontSize: 11 }}
          >
            {t('marker.short')}
          </Button>
        </Tooltip>
        {showLabels && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 12px',
              background: 'rgba(40,40,40,0.9)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              whiteSpace: 'nowrap',
              zIndex: 20,
            }}
          >
            <label style={{ fontSize: 12, color: '#ccc', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showDims} onChange={toggleDim} />
              {t('marker.dims')}
            </label>
            <label style={{ fontSize: 12, color: '#ccc', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showShelfIds} onChange={toggleShelfId} />
              {t('marker.layerIds')}
            </label>
          </div>
        )}
        <Tooltip content={pinned ? t('tip.pinnedHide') : t('tip.pinnedShow')}>
          <Button
            theme="borderless"
            size="small"
            onClick={() => setPinned(!pinned)}
            style={{ color: 'rgba(255,255,255,0.6)', padding: '0 4px', minWidth: 24, fontSize: 11 }}
          >
            {pinned ? t('marker.pinned') : t('marker.auto')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default PresetViewButtons;
