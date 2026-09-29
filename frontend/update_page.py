import os

def update_page():
    with open('src/pages/admin/AdminHealthPage.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    search = '''      <div className="grid gap-3">
        <Dot ok={h.database} label="PostgreSQL" sub="Primary data store" />
        <Dot ok={h.redis} label="Redis" sub={`${h.pending_jobs} jobs pending`} />
        <Dot ok={h.storage_writable} label="Object storage" sub="/data is writable" />
        <Dot ok={h.celery_workers > 0} label="Celery workers"
             sub={`${h.celery_workers} workers online`} />
      </div>

      <section className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-900 mb-2">Versions</h3>
        <dl className="text-sm grid grid-cols-2 gap-2">
          {Object.entries(h.versions).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-900 font-mono">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>'''

    replace = '''      <div className="grid gap-3">
        <Dot ok={h.database.ok} label="PostgreSQL" sub={`Ping: ${h.database.ping_ms}ms | Pool: ${h.database.pool.checked_out}/${h.database.pool.size} (overflow: ${h.database.pool.overflow})`} />
        <Dot ok={h.redis.ok} label="Redis" sub={`Ping: ${h.redis.ping_ms}ms`} />
        <Dot ok={h.storage.free_gb > 0} label="Object storage" sub={`Used: ${h.storage.used_gb}GB / ${h.storage.total_gb}GB (${h.storage.percent}%)`} />
        <Dot ok={h.celery.workers > 0} label="Celery workers" sub={`${h.celery.workers} workers online`} />
      </div>

      <section className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-900 mb-2">Uptime</h3>
        <p className="text-sm text-slate-500">{h.uptime_sec} seconds</p>
      </section>'''

    content = content.replace(search, replace)
    with open('src/pages/admin/AdminHealthPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

update_page()
