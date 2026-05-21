import EditableText from '../EditableText.jsx'
import ImageSlot from '../ImageSlot.jsx'

// One location block: the wide hero image with an editable name caption
// overlaid bottom-left. Used both for the primary location
// (brief.environment) and any additional ones (brief.environments[i]).
function LocationBlock({ data, setField, onRemove, label, dataIndex }) {
  const hero = data?.heroEnvironment ?? 'cinematic location'
  const elements = data?.keyElements?.slice(0, 3).join(', ') ?? ''

  return (
    <div className="loc-block">
      {onRemove && (
        <div className="loc-block-header">
          <span className="loc-block-label">{label}</span>
          <button className="loc-block-remove" onClick={onRemove} title="Remove this location">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
      <div className="loc-hero-wrap">
        <ImageSlot
          ratio="16:9"
          slimWhenEmpty
          prompt={`${hero}, ${elements}, wide establishing shot, golden hour, cinematic photography`}
          slotId={`env.${dataIndex ?? 'primary'}`}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10 }}
        />
        <div className="loc-hero-caption">
          <EditableText
            className="loc-hero-name"
            value={data?.heroName}
            onChange={v => setField('heroName', v)}
            placeholder="Name this location (used as @handle)…"
          />
        </div>
      </div>
    </div>
  )
}

// Wonder Workshop locations: a primary hero with optional additional
// locations stacked below. Each location supports upload or generate
// via its ImageSlot; the name doubles as the @handle for shot prompts.
export default function LocationsSetDesign({
  primaryLocation,
  additionalLocations,
  update,
  addLocation,
  updateLocationAt,
  removeLocationAt,
}) {
  return (
    <div className="loc-list">
      <LocationBlock
        data={primaryLocation}
        setField={(field, value) => update?.(`environment.${field}`, value)}
        dataIndex="primary"
      />

      {(additionalLocations || []).map((loc, idx) => (
        <LocationBlock
          key={idx}
          data={loc}
          label={loc?.heroName ? `Location — ${loc.heroName}` : `Location ${idx + 2}`}
          setField={(field, value) => updateLocationAt?.(idx, field, value)}
          onRemove={() => removeLocationAt?.(idx)}
          dataIndex={String(idx)}
        />
      ))}

      <button className="loc-add-row" onClick={addLocation} type="button">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <span>Add location</span>
      </button>
    </div>
  )
}
