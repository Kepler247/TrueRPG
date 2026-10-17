import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SystemHubPage } from './system-hub.page';

describe('System reference hub', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('loads the selected source, searches text, and filters lore', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: '501 Rads',
        revision: 'draft-1',
        sourceFile: '501-rads-draft-1.pdf',
        pageCount: 2,
        pages: [
          {
            number: 1,
            category: 'lore',
            blocks: [
              { kind: 'heading', text: 'Radiomen' },
              { kind: 'paragraph', text: 'Wacky Jack lore' },
            ],
          },
          {
            number: 2,
            category: 'rules',
            blocks: [
              { kind: 'heading', text: 'Gunslinger Heat' },
              {
                kind: 'table',
                text: 'Weapon Damage Test pistol 1d6',
                rows: [
                  ['Weapon', 'Damage'],
                  ['Test pistol', '1d6'],
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const params = convertToParamMap({ slug: '501-rads' });
    TestBed.configureTestingModule({
      imports: [SystemHubPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(params), snapshot: { paramMap: params } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SystemHubPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    await vi.waitFor(() => expect(page.document()).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/systems/501-rads/core-2.json', expect.any(Object));
    expect(page.matches()).toHaveLength(2);
    page.view.set('map');
    fixture.detectChanges();
    const map = fixture.nativeElement.querySelector('app-setting-map');
    expect(map.querySelector('img').getAttribute('src')).toBe(
      '/systems/501-rads/north-america-map.jpg',
    );
    const zoomIn = map.querySelector('button[aria-label="Zoom in"]');
    zoomIn.click();
    fixture.detectChanges();
    expect(map.querySelector('img').style.width).toBe('150%');
    page.view.set('reference');
    fixture.detectChanges();
    page.category.set('lore');
    expect(page.matches()).toHaveLength(1);
    page.query.set('heat');
    expect(page.matches()).toHaveLength(0);
    page.category.set('all');
    expect(page.current()?.number).toBe(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fan the Hammer costs 2 Heat');
    expect(fixture.nativeElement.querySelectorAll('table tr')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('table tr')[1].cells[1].textContent).toBe('1d6');
    page.query.set('test pistol');
    expect(page.matches()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('a[target="_blank"]').getAttribute('href')).toBe(
      '/systems/501-rads/501-rads-draft-1.pdf',
    );
  });
  it('loads D&DS and leaves ship sections available only through the PDF', async () => {
    const params = convertToParamMap({ slug: 'dnds' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'D&DS',
        revision: 'original',
        sourceFile: 'dnds-original.pdf',
        pageCount: 85,
        pages: [
          { number: 2, category: 'lore', blocks: [{ kind: 'heading', text: 'Civilizations' }] },
          {
            number: 30,
            category: 'ship-reference',
            blocks: [{ kind: 'heading', text: 'Ship combat' }],
          },
          { number: 56, category: 'rules', blocks: [{ kind: 'heading', text: 'Firearms' }] },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      imports: [SystemHubPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(params), snapshot: { paramMap: params } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SystemHubPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    await vi.waitFor(() => expect(page.document()).not.toBeNull());
    fixture.detectChanges();
    expect(fetchMock).toHaveBeenCalledWith('/systems/dnds/original.json', expect.any(Object));
    expect(page.matches().map((s) => s.heading)).toEqual(['Civilizations', 'Firearms']);
    expect(fixture.nativeElement.querySelector('a[target="_blank"]').getAttribute('href')).toBe(
      '/systems/dnds/dnds-original.pdf',
    );
  });
});
