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
          { number: 2, category: 'rules', blocks: [{ kind: 'heading', text: 'Gunslinger Heat' }] },
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
    expect(fetchMock).toHaveBeenCalledWith('/systems/501-rads/draft-1.json', expect.any(Object));
    expect(page.matches()).toHaveLength(2);
    page.category.set('lore');
    expect(page.matches()).toHaveLength(1);
    page.query.set('heat');
    expect(page.matches()).toHaveLength(0);
    page.category.set('all');
    expect(page.current()?.number).toBe(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fan the Hammer costs 2 Heat');
    expect(fixture.nativeElement.querySelector('a[target="_blank"]').getAttribute('href')).toBe(
      '/systems/501-rads/501-rads-draft-1.pdf',
    );
  });
});
