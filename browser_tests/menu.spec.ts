import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    const currentThemeId = await comfyPage.menu.getThemeId()
    if (currentThemeId !== 'dark') {
      await comfyPage.menu.toggleTheme()
    }
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  // Skip reason: Flaky.
  test.skip('Toggle theme', async ({ comfyPage }) => {
    test.setTimeout(30000)

    expect(await comfyPage.menu.getThemeId()).toBe('dark')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('light')

    // Theme id should persist after reload.
    await comfyPage.page.reload()
    await comfyPage.setup()
    expect(await comfyPage.menu.getThemeId()).toBe('light')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('dark')
  })

  test('Can register sidebar tab', async ({ comfyPage }) => {
    const initialChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )

    await comfyPage.page.evaluate(async () => {
      window['app'].extensionManager.registerSidebarTab({
        id: 'search',
        icon: 'pi pi-search',
        title: 'search',
        tooltip: 'search',
        type: 'custom',
        render: (el) => {
          el.innerHTML = '<div>Custom search tab</div>'
        }
      })
    })
    await comfyPage.nextFrame()

    const newChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )
    expect(newChildrenCount).toBe(initialChildrenCount + 1)
  })

  test.describe('Node library sidebar', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {})
      // Open the sidebar
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.open()
    })

    test('Node preview and drag to canvas', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()

      // Hover over a node to display the preview
      const nodeSelector = '.p-tree-node-leaf'
      await comfyPage.page.hover(nodeSelector)

      // Verify the preview is displayed
      const previewVisible = await comfyPage.page.isVisible(
        '.node-lib-node-preview'
      )
      expect(previewVisible).toBe(true)

      const count = await comfyPage.getGraphNodesCount()
      // Drag the node onto the canvas
      const canvasSelector = '#graph-canvas'
      await comfyPage.page.dragAndDrop(nodeSelector, canvasSelector)

      // Verify the node is added to the canvas
      expect(await comfyPage.getGraphNodesCount()).toBe(count + 1)
    })

    test('Bookmark node', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()

      // Bookmark the node
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()

      // Verify the bookmark is added to the bookmarks tab
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['KSamplerAdvanced'])
      // Verify the bookmark node with the same name is added to the tree.
      expect(await tab.getNode('KSampler (Advanced)').count()).toBe(2)

      // Hover on the bookmark node to display the preview
      await comfyPage.page.hover('.node-lib-bookmark-tree-explorer .tree-leaf')
      expect(await comfyPage.page.isVisible('.node-lib-node-preview')).toBe(
        true
      )
    })

    test('Ignores unrecognized node', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo'])

      const tab = comfyPage.menu.nodeLibraryTab
      expect(await tab.getFolder('sampling').count()).toBe(1)
      expect(await tab.getNode('foo').count()).toBe(0)
    })

    test('Displays empty bookmarks folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      expect(await tab.getFolder('foo').count()).toBe(1)
    })

    test('Can add new bookmark folder', async ({ comfyPage }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.newFolderButton.click()
      await comfyPage.page.keyboard.press('Enter')
      expect(await tab.getFolder('New Folder').count()).toBe(1)
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['New Folder/'])
    })

    test('Can add nested bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('New Folder').click()
      await comfyPage.page.keyboard.type('bar')
      await comfyPage.page.keyboard.press('Enter')

      expect(await tab.getFolder('bar').count()).toBe(1)
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/bar/'])
    })

    test('Can delete bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Delete').click()

      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })

    test('Can rename bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab

      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page
        .locator('.p-contextmenu-item-label:has-text("Rename")')
        .click()
      await comfyPage.page.keyboard.insertText('bar')
      await comfyPage.page.keyboard.press('Enter')

      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['bar/'])
    })

    test('Can add bookmark by dragging node to bookmark folder', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await comfyPage.page.dragAndDrop(
        tab.nodeSelector('KSampler (Advanced)'),
        tab.folderSelector('foo')
      )
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/KSamplerAdvanced'])
    })

    test('Can add bookmark by clicking bookmark button', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['KSamplerAdvanced'])
    })

    test('Can unbookmark node (Top level bookmark)', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'KSamplerAdvanced'
      ])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab
        .getNode('KSampler (Advanced)')
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })

    test('Can unbookmark node (Library node bookmark)', async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'KSamplerAdvanced'
      ])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('sampling').click()
      await comfyPage.page
        .locator(tab.nodeSelector('KSampler (Advanced)'))
        .nth(1)
        .locator('.bookmark-button')
        .click()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
    })
    test('Can customize icon', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Customize').click()
      await comfyPage.page
        .locator('.icon-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page
        .locator('.color-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page.getByLabel('Confirm').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
    })
    // If color is left as default, it should not be saved
    test('Can customize icon (default field)', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Customize').click()
      await comfyPage.page
        .locator('.icon-field .p-selectbutton > *:nth-child(2)')
        .click()
      await comfyPage.page.getByLabel('Confirm').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'foo/': {
          icon: 'pi-folder'
        }
      })
    })
    test('Can rename customized bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page
        .locator('.p-contextmenu-item-label:has-text("Rename")')
        .click()
      await comfyPage.page.keyboard.insertText('bar')
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['bar/'])
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({
        'bar/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
    })

    test('Can delete customized bookmark folder', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', ['foo/'])
      await comfyPage.setSetting('Comfy.NodeLibrary.BookmarksCustomization', {
        'foo/': {
          icon: 'pi-folder',
          color: '#007bff'
        }
      })
      const tab = comfyPage.menu.nodeLibraryTab
      await tab.getFolder('foo').click({ button: 'right' })
      await comfyPage.page.getByLabel('Delete').click()
      await comfyPage.nextFrame()
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual([])
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.BookmarksCustomization')
      ).toEqual({})
    })

    test('Can filter nodes in both trees', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'foo/',
        'foo/KSamplerAdvanced',
        'KSampler'
      ])

      const tab = comfyPage.menu.nodeLibraryTab
      await tab.nodeLibrarySearchBoxInput.fill('KSampler')
      // Node search box is debounced and may take some time to update.
      await comfyPage.page.waitForTimeout(1000)
      expect(await tab.getNode('KSampler (Advanced)').count()).toBe(2)
    })

    test('Can migrate legacy bookmarks', async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks', [
        'foo/',
        'foo/KSampler (Advanced)',
        'UNKNOWN',
        'KSampler'
      ])
      await comfyPage.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [])
      await comfyPage.page.reload()
      await comfyPage.setup()
      expect(await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks')).toEqual(
        []
      )
      expect(
        await comfyPage.getSetting('Comfy.NodeLibrary.Bookmarks.V2')
      ).toEqual(['foo/', 'foo/KSamplerAdvanced', 'KSampler'])
    })
  })

  test('Can change canvas zoom speed setting', async ({ comfyPage }) => {
    const [defaultSpeed, maxSpeed] = [1.1, 2.5]
    expect(await comfyPage.getSetting('Comfy.Graph.ZoomSpeed')).toBe(
      defaultSpeed
    )
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', maxSpeed)
    expect(await comfyPage.getSetting('Comfy.Graph.ZoomSpeed')).toBe(maxSpeed)
    await comfyPage.page.reload()
    await comfyPage.setup()
    expect(await comfyPage.getSetting('Comfy.Graph.ZoomSpeed')).toBe(maxSpeed)
    await comfyPage.setSetting('Comfy.Graph.ZoomSpeed', defaultSpeed)
  })
})
