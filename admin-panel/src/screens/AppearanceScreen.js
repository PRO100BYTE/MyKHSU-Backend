import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ADMIN_ACCENT_COLORS, ADMIN_THEMES, ADMIN_UI } from '../constants';

export default function AppearanceScreen() {
  const {
    theme,
    accentColor,
    showNavLabels,
    uiDensity,
    setTheme,
    setAccentColor,
    setShowNavLabels,
    setUiDensity,
  } = useTheme();

  return (
    <div className="screen-stack">
      <div className="screen-hero">
        <div className="screen-hero__icon">
          <ion-icon name="color-palette-outline" />
        </div>
        <div>
          <div className="screen-hero__title">Внешний вид</div>
          <div className="screen-hero__sub">Темы, акценты и визуальная атмосфера в стиле MyKHSU</div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Тема интерфейса</div>
            <div className="card__subtitle">Темы синхронизированы с мобильным приложением</div>
          </div>
        </div>
        <div className="card__body appearance-grid">
          {ADMIN_UI.themeOptions.map(themeKey => {
            const option = ADMIN_THEMES[themeKey];
            const active = theme === themeKey;

            return (
              <button
                key={themeKey}
                className={`appearance-tile${active ? ' active' : ''}`}
                onClick={() => setTheme(themeKey)}
              >
                <div className="appearance-tile__row">
                  <span className="appearance-tile__icon">
                    <ion-icon name={option.icon} />
                  </span>
                  <span className="appearance-tile__name">{option.label}</span>
                </div>
                <span className="appearance-tile__status">
                  {active ? 'Активна' : 'Выбрать'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Акцентный цвет</div>
            <div className="card__subtitle">Используется в кнопках, фокусах и статусах</div>
          </div>
        </div>
        <div className="card__body">
          <div className="accent-grid">
            {ADMIN_UI.accentOptions.map(accentKey => {
              const option = ADMIN_ACCENT_COLORS[accentKey];
              const active = accentColor === accentKey;

              return (
                <button
                  key={accentKey}
                  className={`accent-chip${active ? ' active' : ''}`}
                  onClick={() => setAccentColor(accentKey)}
                >
                  <span className="accent-chip__dot" style={{ '--dot-color': option.primary }} />
                  <span>{option.label}</span>
                  {active ? <ion-icon name="checkmark" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">Предпросмотр</div>
        </div>
        <div className="card__body">
          <div className="preview-surface">
            <div className="preview-surface__badge">{theme}</div>
            <div className="preview-surface__headline">Мой ИТИ ХГУ</div>
            <div className="preview-surface__line">Текущий акцент: {ADMIN_ACCENT_COLORS[accentColor]?.label}</div>
            <div className="preview-surface__actions">
              <button className="btn btn-primary btn-sm">Primary</button>
              <button className="btn btn-ghost btn-sm">Ghost</button>
              <button className="btn btn-danger btn-sm">Danger</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Навигация и плотность</div>
            <div className="card__subtitle">Desktop-аналог настроек панели из мобильной версии</div>
          </div>
        </div>
        <div className="card__body appearance-controls">
          <label className="switch-row">
            <span>
              <strong>Показывать подписи меню</strong>
              <small>Если отключить, в сайдбаре останутся только иконки</small>
            </span>
            <input
              type="checkbox"
              checked={showNavLabels}
              onChange={(event) => setShowNavLabels(event.target.checked)}
            />
          </label>

          <div className="density-group">
            <div className="density-group__title">Плотность интерфейса</div>
            <div className="density-group__controls">
              <button
                className={`density-pill${uiDensity === 'comfortable' ? ' active' : ''}`}
                onClick={() => setUiDensity('comfortable')}
              >
                Комфортная
              </button>
              <button
                className={`density-pill${uiDensity === 'compact' ? ' active' : ''}`}
                onClick={() => setUiDensity('compact')}
              >
                Компактная
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
