import { createApp, ref } from 'vue'
import AnnotationOverlay from '@laoliangfe/annotation-overlay'
import '@laoliangfe/annotation-overlay/style.css'

const app = createApp({
  setup() {
    const annoRef = ref<any>(null)
    const isOpen = ref(false)
    const statusDotRef = ref<HTMLElement>()
    const statusTextRef = ref<HTMLElement>()

    const setStatus = (active: boolean, message: string) => {
      if (statusDotRef.value) {
        statusDotRef.value.className = `status-dot ${active ? 'active' : 'idle'}`
      }
      if (statusTextRef.value) {
        statusTextRef.value.textContent = message
      }
    }

    const openAnnotation = async () => {
      const targetArea = document.getElementById('targetArea')

      if (isOpen.value) {
        annoRef.value?.close()
        isOpen.value = false
        setStatus(false, '已关闭标注')
        return
      }

      try {
        setStatus(true, '⏳ 正在准备截图...')
        if (annoRef.value && targetArea) {
          await annoRef.value.open(targetArea)
          isOpen.value = true
          setStatus(true, '✏️ 标注模式已开启')
        }
      } catch (error) {
        console.error('打开标注失败:', error)
        setStatus(false, '❌ 打开失败')
      }
    }

    const resetDemo = () => {
      if (isOpen.value) {
        annoRef.value?.close()
        isOpen.value = false
      }
      const targetArea = document.getElementById('targetArea')
      if (targetArea) {
        targetArea.style.outline = 'none'
      }
      setStatus(false, '🔄 已重置')
      setTimeout(() => setStatus(false, '就绪 — 点击「添加标注」开始'), 1000)
    }

    const handleConfirm = (payload: any) => {
      console.log('✅ 确认标注:', payload)
      setStatus(false, '✅ 标注已确认')
      isOpen.value = false
    }

    const handleCancel = () => {
      console.log('❌ 取消标注')
      setStatus(false, '❌ 已取消标注')
      isOpen.value = false
    }

    setStatus(false, '就绪 — 点击「添加标注」开始')
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        openAnnotation()
    }
    })

    return {
      annoRef,
      statusDotRef,
      statusTextRef,
      openAnnotation,
      resetDemo,
      handleConfirm,
      handleCancel,
    }
  },
})

app.use(AnnotationOverlay)
app.mount('#app')