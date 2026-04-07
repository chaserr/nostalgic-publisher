import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeneratorService } from '../../../src/main/services/generator'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              song_name: '同桌的你',
              year: 1994,
              title: '《同桌的你》1994',
              content: '高三最后一个夏天，班里有人把这首歌刻成磁带...',
            }),
          },
        ],
      }),
    }
  },
}))

const mockSettingsDB = {
  get: vi.fn().mockReturnValue('sk-test-key'),
  set: vi.fn(),
}

describe('GeneratorService', () => {
  let generator: GeneratorService

  beforeEach(() => {
    generator = new GeneratorService(mockSettingsDB as any)
  })

  it('generates an article with song name', async () => {
    const result = await generator.generate('同桌的你')
    expect(result.song_name).toBe('同桌的你')
    expect(result.year).toBe(1994)
    expect(result.title).toBeTruthy()
    expect(result.content).toBeTruthy()
  })

  it('generates an article without song name (picks random)', async () => {
    const result = await generator.generate()
    expect(result.song_name).toBeTruthy()
  })

  it('throws when Claude API key is not set', async () => {
    mockSettingsDB.get.mockReturnValueOnce(null)
    await expect(generator.generate()).rejects.toThrow('Claude API Key 未配置')
  })
})
