import Anthropic from '@anthropic-ai/sdk'
import type { SettingsDB } from '../db/settings'

const SONG_LIBRARY = [
  { name: '同桌的你', year: 1994 },
  { name: '朋友', year: 1997 },
  { name: '心动', year: 1999 },
  { name: '执迷不悔', year: 1993 },
  { name: '童年', year: 1983 },
  { name: '外面的世界', year: 1987 },
  { name: '睡在我上铺的兄弟', year: 1997 },
  { name: '老鼠爱大米', year: 2004 },
  { name: '两只蝴蝶', year: 2004 },
  { name: '丁香花', year: 2004 },
  { name: '漂洋过海来看你', year: 1990 },
  { name: '至少还有你', year: 2000 },
  { name: '流着泪的你的脸', year: 1998 },
  { name: '蜗牛', year: 2002 },
  { name: '阳光总在风雨后', year: 1999 },
]

interface GeneratedDraft {
  song_name: string
  year: number
  title: string
  content: string
}

export class GeneratorService {
  constructor(private settingsDB: SettingsDB) {}

  async generate(songName?: string): Promise<GeneratedDraft> {
    const apiKey = this.settingsDB.get('claude_api_key')
    if (!apiKey) throw new Error('Claude API Key 未配置，请在设置中填写')

    const song = songName
      ? SONG_LIBRARY.find((s) => s.name === songName) ?? { name: songName, year: 2000 }
      : SONG_LIBRARY[Math.floor(Math.random() * SONG_LIBRARY.length)]

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `你是一个擅写青春故事的公众号创作者。
以《${song.name}》(${song.year}) 为背景音乐，写一个200字以内的青春故事。
要求：
- 聚焦一个具体场景（暗恋/毕业/旅途/网吧/绿皮车等）
- 引用歌词中一句话
- 结尾以问句与读者互动
- 不写歌手生平，主角是读者自己的记忆
- 文笔要有画面感，情感要真实

请以 JSON 格式输出，包含字段：song_name, year, title, content
title 格式：《${song.name}》${song.year}
content 是纯文本正文（包含引用歌词和结尾问句）
只输出 JSON，不要其他内容。`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude 返回格式异常')

    const data = JSON.parse(jsonMatch[0])
    return {
      song_name: data.song_name ?? song.name,
      year: data.year ?? song.year,
      title: data.title,
      content: data.content,
    }
  }
}
