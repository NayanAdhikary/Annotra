import os

def update():
    with open('src/pages/TaskSetupPage.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    import_str = 'import { ImageUploader } from \'../components/Upload/ImageUploader\';\nimport { ImageGrid } from \'../components/Upload/ImageGrid\';'
    content = content.replace('import { ImageUploader } from \'../components/Upload/ImageUploader\';', import_str)

    search = '''                                    <div className="grid grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
                                        {images.map(img => (
                                            <div key={img.id} className="relative aspect-square bg-slate-100 rounded-md overflow-hidden border border-slate-200 group">
                                                <img src={img.url} alt={img.filename} className="object-cover w-full h-full" />
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] truncate px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {img.filename}
                                                </div>
                                            </div>
                                        ))}
                                    </div>'''

    replace = '''                                    <ImageGrid images={images} onOpen={() => navigate(`/tasks/${id}`)} />'''

    content = content.replace(search, replace)

    with open('src/pages/TaskSetupPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

update()
