// 定义 JSON 类型基于 schema
import { Context } from 'koishi';
import { promises } from 'node:fs';
import path from 'node:path';
import { minecraftSummaryTypeMap } from './changelog-summarizer';

interface Subcategory {
    subcategory: string;
    emoji: string;
    items: string[];
}

interface CategoryGroup {
    general: string[];
    subcategories: Subcategory[];
}

interface MinecraftSummary {
    new_features: CategoryGroup;
    improvements: CategoryGroup;
    balancing: CategoryGroup;
    bug_fixes: CategoryGroup;
    technical_changes: CategoryGroup;
}

// 函数：生成 XAML 字符串
function generateXaml(summary: MinecraftSummary, version: string): string {
    const orderedCategories: (keyof MinecraftSummary)[] = [
        'new_features',
        'improvements',
        'balancing',
        'bug_fixes',
        'technical_changes',
    ];

    // 构建类别卡片部分
    let categoriesXaml = '';
    for (const category of orderedCategories) {
        const catData = summary[category];
        const general = catData.general || [];
        const subcategories = catData.subcategories || [];
        if (general.length === 0 && subcategories.length === 0) continue; // 跳过空类别

        const categoryTitle = minecraftSummaryTypeMap[category];

        let contentXaml = '';

        // General 项
        for (let i = 0; i < general.length; i++) {
            const msg = general[i];
            const margin =
                i === general.length - 1 && subcategories.length > 0
                    ? '0,0,0,10'
                    : '0,0,0,2';
            contentXaml += `
                    <TextBlock
                        Margin="${margin}"
                        Foreground="{DynamicResource ColorBrush1}"
                        Text="- ${msg}" />`;
        }

        // 子类别
        for (let j = 0; j < subcategories.length; j++) {
            const sub = subcategories[j];
            contentXaml += `
                    <TextBlock
                        Margin="0,0,0,4"
                        FontSize="14"
                        Foreground="{DynamicResource ColorBrush3}"
                        Text="${sub.emoji} ${sub.subcategory}" />`;
            for (let k = 0; k < sub.items.length; k++) {
                const msg = sub.items[k];
                const margin =
                    k === sub.items.length - 1 && j === subcategories.length - 1
                        ? ''
                        : 'Margin="0,0,0,2"';
                contentXaml += `
                    <TextBlock
                        ${margin}
                        Foreground="{DynamicResource ColorBrush1}"
                        Text="  - ${msg}" />`;
            }
            if (j < subcategories.length - 1) {
                contentXaml += `
                    <!-- Spacer for subcategories -->
                    <TextBlock Margin="0,0,0,10" />`;
            }
        }

        // 包装成 MyCard
        categoriesXaml += `
            <!--  ${categoryTitle}卡片  -->
            <local:MyCard
                Title="${categoryTitle}"
                Margin="0,5,0,10"
                CanSwap="True"
                IsSwaped="${general.length > 0 || subcategories.length > 1 ? 'False' : 'True'}"
                Style="{StaticResource Card}">
                <StackPanel Orientation="Vertical" Style="{StaticResource ContentStack}">
${contentXaml}
                </StackPanel>
            </local:MyCard>`;
    }

    // 完整 XAML 模板
    return `<StackPanel
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="clr-namespace:PCL2;assembly=PCL2"
    xmlns:sys="clr-namespace:System;assembly=mscorlib">
    <StackPanel.Resources>
        <Style x:Key="Card" TargetType="local:MyCard">
            <Setter Property="Margin" Value="0,5" />
        </Style>
        <Style x:Key="ContentStack" TargetType="StackPanel">
            <Setter Property="Margin" Value="20,40,20,20" />
        </Style>
        <Style TargetType="TextBlock">
            <Setter Property="TextWrapping" Value="Wrap" />
            <Setter Property="HorizontalAlignment" Value="Left" />
            <Setter Property="FontSize" Value="13" />
            <Setter Property="Foreground" Value="{DynamicResource ColorBrush1}" />
        </Style>
    </StackPanel.Resources>
    <local:MyCard
        Title="🔔 Minecraft ${version} 更新总结"
        Margin="0,0,0,0"
        CanSwap="True"
        IsSwaped="False"
        Style="{StaticResource Card}">
        <StackPanel Orientation="Vertical" Style="{StaticResource ContentStack}">
${categoriesXaml}
            <!--  底部按钮：刷新、Wiki、启动游戏  -->
            <StackPanel
                Margin="0,20,0,0"
                HorizontalAlignment="Center"
                Orientation="Horizontal">
                <local:MyButton
                    Width="100"
                    Height="35"
                    Margin="5,0,5,0"
                    ColorType="Highlight"
                    EventType="刷新主页"
                    Text="🔄 刷新更新"
                    ToolTip="从 API 拉取最新内容" />
                <local:MyButton
                    Width="100"
                    Height="35"
                    Margin="5,0,5,0"
                    ColorType="Highlight"
                    EventData="https://zh.minecraft.wiki/"
                    EventType="打开网页"
                    Text="📖 查看 Wiki"
                    ToolTip="官方中文 Wiki" />
                <local:MyButton
                    Width="100"
                    Height="35"
                    Margin="5,0,5,0"
                    ColorType="Red"
                    EventData="${version}"
                    EventType="启动游戏"
                    Text="▶️ 启动游戏"
                    ToolTip="启动 ${version} 版本" />
            </StackPanel>
        </StackPanel>
    </local:MyCard>
</StackPanel>`;
}

export async function exportXaml(
    ctx: Context,
    summary: MinecraftSummary,
    version: string
): Promise<string> {
    const xaml = generateXaml(summary, version);
    const xamlPath = path.join(
        ctx.baseDir,
        'data',
        'minecraft-notifier',
        'xaml'
    );
    const xamlName = `${version}.xaml`;
    let fullXamlPath = path.join(xamlPath, xamlName);
    let fullHomePagePath = path.join(xamlPath, 'PCL.HomePage.xaml');

    await promises.writeFile(fullXamlPath, xaml);
    await promises.copyFile(fullXamlPath, fullHomePagePath);
    return fullXamlPath;
}
