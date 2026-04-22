import React from 'react';

export default function BrandMark({ className = '' }) {
  const classes = ['brand-mark', className].filter(Boolean).join(' ');

  return (
    <div className={classes} aria-hidden="true">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="brand-mark__tile" />
      ))}
    </div>
  );
}
